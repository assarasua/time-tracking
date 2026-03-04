import { Role } from "@prisma/client";
import { addDays, endOfMonth, endOfWeek, format, formatISO, isWithinInterval, startOfMonth, startOfWeek } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { minutesBetween, weekStartFromParam } from "@/lib/time";

type SearchParams = Promise<{ week_start?: string; month?: string }>;

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== Role.admin) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const organization = await db.organization.findUnique({
    where: { id: session.user.organizationId }
  });

  const weekStartDay = organization?.weekStartDay ?? 1;
  const now = new Date();
  let weekStart = startOfWeek(now, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  if (params.week_start) {
    try {
      weekStart = weekStartFromParam(params.week_start, weekStartDay);
    } catch {
      weekStart = startOfWeek(now, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    }
  }
  const selectedMonth = params.month ?? format(now, "yyyy-MM");
  const parsedMonthStart = startOfMonth(new Date(`${selectedMonth}-01T00:00:00.000Z`));
  const monthStart = Number.isNaN(parsedMonthStart.getTime()) ? startOfMonth(now) : parsedMonthStart;
  const effectiveWeekEnd = endOfWeek(weekStart, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  const effectiveMonthEnd = endOfMonth(monthStart);
  const startBoundary = monthStart < weekStart ? monthStart : weekStart;
  const endBoundary = effectiveMonthEnd > effectiveWeekEnd ? effectiveMonthEnd : effectiveWeekEnd;
  const exportFrom = formatISO(monthStart, { representation: "date" });
  const exportTo = formatISO(effectiveMonthEnd, { representation: "date" });

  const [members, locks, sessions] = await Promise.all([
    db.organizationUser.findMany({
      where: {
        organizationId: session.user.organizationId
      },
      include: {
        user: true
      },
      orderBy: {
        createdAt: "asc"
      }
    }),
    db.weekLock.findMany({
      where: {
        organizationId: session.user.organizationId
      },
      orderBy: {
        weekStart: "desc"
      },
      take: 6
    }),
    db.timeSession.findMany({
      where: {
        organizationUser: {
          organizationId: session.user.organizationId
        },
        startAt: {
          gte: startBoundary,
          lte: endBoundary
        },
        endAt: {
          not: null
        }
      },
      select: {
        id: true,
        organizationUserId: true,
        startAt: true,
        endAt: true
      }
    })
  ]);

  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const hoursByMember = new Map<
    string,
    {
      dailyMinutes: number[];
      weeklyMinutes: number;
      monthlyMinutes: number;
    }
  >();

  members.forEach((member) => {
    hoursByMember.set(member.id, {
      dailyMinutes: Array.from({ length: 7 }, () => 0),
      weeklyMinutes: 0,
      monthlyMinutes: 0
    });
  });

  sessions.forEach((sessionItem) => {
    if (!sessionItem.endAt) return;

    const minutes = minutesBetween(sessionItem.startAt, sessionItem.endAt);
    const bucket = hoursByMember.get(sessionItem.organizationUserId);
    if (!bucket) return;

    if (isWithinInterval(sessionItem.startAt, { start: monthStart, end: effectiveMonthEnd })) {
      bucket.monthlyMinutes += minutes;
    }

    if (isWithinInterval(sessionItem.startAt, { start: weekStart, end: effectiveWeekEnd })) {
      bucket.weeklyMinutes += minutes;
      const dayIndex = weekDays.findIndex((day) => format(day, "yyyy-MM-dd") === format(sessionItem.startAt, "yyyy-MM-dd"));
      if (dayIndex >= 0) {
        bucket.dailyMinutes[dayIndex] += minutes;
      }
    }
  });

  return (
    <div className="space-y-5">
      <AppNav role={session.user.role} />

      <Card>
        <CardHeader>
          <CardTitle>View filters</CardTitle>
          <CardDescription>Select which week and month to display in admin analytics.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" action="/admin" className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Week start</span>
              <input
                type="date"
                name="week_start"
                defaultValue={formatISO(weekStart, { representation: "date" })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Month</span>
              <input
                type="month"
                name="month"
                defaultValue={format(monthStart, "yyyy-MM")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-nav-selected"
              >
                Apply filters
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
          <CardDescription>Active organization members and their roles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{member.user.name ?? member.user.email}</p>
                <p className="text-xs text-muted-foreground">{member.user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-success px-3 py-1 text-xs font-semibold text-success-foreground">
                  {member.role}
                </span>
                <Link
                  href={`/api/exports/payroll.csv?from=${exportFrom}&to=${exportTo}&membership_id=${member.id}`}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  Download CSV
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent locked weeks</CardTitle>
          <CardDescription>Auto and manual lock activity for payroll safety ({formatISO(weekStart, { representation: "date" })} week).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {locks.length === 0 ? <p className="text-sm text-muted-foreground">No locked weeks yet.</p> : null}
          {locks.map((lock) => (
            <div
              key={lock.id}
              className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-sm"
            >
              <span className="font-medium text-foreground">{formatISO(lock.weekStart, { representation: "date" })}</span>
              <span className="text-muted-foreground">{lock.autoLocked ? "Auto" : "Manual"}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employee hours overview</CardTitle>
          <CardDescription>
            Selected week daily hours plus weekly and monthly totals per employee.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Employee</th>
                  {weekDays.map((day) => (
                    <th key={day.toISOString()} className="px-3 py-2 font-semibold">
                      {format(day, "EEE d")}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-semibold">Week</th>
                  <th className="px-3 py-2 font-semibold">Month</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const bucket = hoursByMember.get(member.id);
                  if (!bucket) return null;

                  return (
                    <tr key={member.id} className="rounded-md border border-border bg-background">
                      <td className="whitespace-nowrap rounded-l-md px-3 py-3 font-medium text-foreground">
                        {member.user.name ?? member.user.email}
                      </td>
                      {bucket.dailyMinutes.map((dayMinutes, index) => (
                        <td key={`${member.id}-${index}`} className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                          {dayMinutes > 0 ? formatMinutes(dayMinutes) : "0h 0m"}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-foreground">
                        {formatMinutes(bucket.weeklyMinutes)}
                      </td>
                      <td className="whitespace-nowrap rounded-r-md px-3 py-3 font-semibold text-foreground">
                        {formatMinutes(bucket.monthlyMinutes)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exports</CardTitle>
          <CardDescription>Download organization CSV or per-person CSV for the current month.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use API endpoint <code>/api/exports/payroll.csv?from=YYYY-MM-DD&to=YYYY-MM-DD</code> to download payroll CSV.
          </p>
          <div>
            <Link
              href={`/api/exports/payroll.csv?from=${exportFrom}&to=${exportTo}`}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-nav-selected"
            >
              Download organization CSV (current month)
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
