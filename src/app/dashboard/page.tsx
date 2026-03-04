import { redirect } from "next/navigation";
import { format, formatISO } from "date-fns";

import { ClockCard } from "@/components/clock-card";
import { AppNav } from "@/components/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

type SearchParams = Promise<{ week_start?: string; month?: string }>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const fallbackWeekStart = formatISO(new Date(), { representation: "date" });
  const fallbackMonth = format(new Date(), "yyyy-MM");
  const selectedWeekStart = params.week_start && DATE_RE.test(params.week_start) ? params.week_start : fallbackWeekStart;
  const selectedMonth = params.month && MONTH_RE.test(params.month) ? params.month : fallbackMonth;

  return (
    <div className="space-y-5">
      <AppNav role={session.user.role} />
      <Card className="border-primary/20 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome, {session.user.name ?? session.user.email}</CardTitle>
          <CardDescription>Track daily sessions, review weekly totals, and manage manual entries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="h-1 w-24 rounded-full bg-primary" />
          <p className="text-sm text-muted-foreground">Use the top navigation tabs to access timesheet and admin areas.</p>
          <form method="get" action="/dashboard" className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Week start</span>
              <input
                type="date"
                name="week_start"
                defaultValue={selectedWeekStart}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Month</span>
              <input
                type="month"
                name="month"
                defaultValue={selectedMonth}
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
      <ClockCard weekStart={selectedWeekStart} month={selectedMonth} />
    </div>
  );
}
