import { format } from "date-fns";
import { redirect } from "next/navigation";

import { getAdminRangeOverviewData } from "@/lib/aggregates";
import { DateRangePresetHeader } from "@/components/date-range-preset-header";
import { ExportDownloadButton } from "@/components/export-download-button";
import { AppNav } from "@/components/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@/lib/db/schema";
import { DATE_RE, getCurrentWeekRange, normalizeRange } from "@/lib/date-range";

type SearchParams = Promise<{ from?: string; to?: string }>;

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
  const normalizedWeekStart = weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const fallback = getCurrentWeekRange(normalizedWeekStart);
  const selected = DATE_RE.test(params.from ?? "") || DATE_RE.test(params.to ?? "")
    ? normalizeRange(params.from ?? fallback.from, params.to ?? fallback.to)
    : fallback;
  const selectedFrom = selected.from;
  const selectedTo = selected.to;
  const exportFrom = selectedFrom;
  const exportTo = selectedTo;

  const [members, overview] = await Promise.all([
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
    getAdminRangeOverviewData({
      organizationId: session.user.organizationId,
      from: selectedFrom,
      to: selectedTo
    })
  ]);

  const rangeDays = overview.days.map((dayKey) => new Date(`${dayKey}T00:00:00.000Z`));
  const hoursByMember = new Map(
    overview.members.map((member) => [
      member.membershipId,
      {
        dailyMinutes: member.dailyMinutes,
        rangeMinutes: member.rangeMinutes
      }
    ])
  );

  return (
    <div className="space-y-5">
      <AppNav role={session.user.role} user={session.user} />

      <Card>
        <CardHeader>
          <CardTitle>View filters</CardTitle>
          <CardDescription>Pick current week, previous, next, or custom range. Monthly CSV exports always use these selected dates.</CardDescription>
        </CardHeader>
        <CardContent>
          <DateRangePresetHeader initialFrom={selectedFrom} initialTo={selectedTo} weekStartsOn={normalizedWeekStart} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
          <CardDescription>Active organization members, roles, and monthly CSV export per selected range.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((member: any) => (
            <div
              key={member.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{member.user.name ?? member.user.email}</p>
                <p className="text-xs text-muted-foreground">{member.user.email}</p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="rounded-full bg-success px-3 py-1 text-xs font-semibold text-success-foreground">
                  {member.role}
                </span>
                <ExportDownloadButton
                  href={`/api/exports/payroll.csv?from=${exportFrom}&to=${exportTo}&membership_id=${member.id}`}
                  label="Download monthly CSV"
                  variant="ghost"
                  className="h-9 border border-border bg-background px-3 text-xs font-semibold text-foreground hover:bg-muted"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employee hours overview</CardTitle>
          <CardDescription>
            Daily hours and totals based on selected filter dates ({selectedFrom} to {selectedTo}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 md:hidden">
            {members.map((member: any) => {
              const bucket = hoursByMember.get(member.id);
              if (!bucket) return null;

              return (
                <details key={member.id} className="rounded-lg border border-border bg-background">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{member.user.name ?? member.user.email}</p>
                      <p className="text-xs text-muted-foreground">Range total</p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{formatMinutes(bucket.rangeMinutes)}</span>
                  </summary>
                  <div className="space-y-2 border-t border-border px-3 py-3">
                    {rangeDays.map((day, index) => (
                      <div key={`${member.id}-${day.toISOString()}`} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{format(day, "EEE d")}</span>
                        <span className="font-medium text-foreground">{formatMinutes(bucket.dailyMinutes[index] ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-card px-3 py-2 font-semibold">Employee</th>
                  {rangeDays.map((day) => (
                    <th key={day.toISOString()} className="px-3 py-2 font-semibold">
                      {format(day, "EEE d")}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-semibold">Range</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member: any) => {
                  const bucket = hoursByMember.get(member.id);
                  if (!bucket) return null;

                  return (
                    <tr key={member.id} className="rounded-md border border-border bg-background">
                      <td className="sticky left-0 z-10 whitespace-nowrap rounded-l-md bg-background px-3 py-3 font-medium text-foreground">
                        {member.user.name ?? member.user.email}
                      </td>
                      {bucket.dailyMinutes.map((dayMinutes, index) => (
                        <td key={`${member.id}-${index}`} className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                          {dayMinutes > 0 ? formatMinutes(dayMinutes) : "0h 0m"}
                        </td>
                      ))}
                      <td className="whitespace-nowrap rounded-r-md px-3 py-3 font-semibold text-foreground">
                        {formatMinutes(bucket.rangeMinutes)}
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
          <CardTitle>Monthly Exports</CardTitle>
          <CardDescription>Download all employees monthly totals for the selected date range.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExportDownloadButton
            href={`/api/exports/payroll.csv?from=${exportFrom}&to=${exportTo}`}
            label="Download all employees monthly CSV"
          />
        </CardContent>
      </Card>
    </div>
  );
}
