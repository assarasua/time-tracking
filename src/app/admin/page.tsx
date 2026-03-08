import { endOfMonth, format, startOfMonth } from "date-fns";
import { redirect } from "next/navigation";

import { getAdminRangeOverviewData } from "@/lib/aggregates";
import { AdminCollapsibleSection } from "@/components/admin-collapsible-section";
import { AdminExpensesSummary } from "@/components/admin-expenses-summary";
import { AdminGoalsSummary } from "@/components/admin-goals-summary";
import { AdminInvoicesSummary } from "@/components/admin-invoices-summary";
import { AdminTimeOffSummary } from "@/components/admin-time-off-summary";
import { DateRangePresetHeader } from "@/components/date-range-preset-header";
import { ExportDownloadButton } from "@/components/export-download-button";
import { AppNav } from "@/components/nav";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@/lib/db/schema";
import { getCurrentWeekRange, resolveRequestedRange } from "@/lib/date-range";
import { getGoalsForQuarterByMembers } from "@/lib/goals";
import { getCurrentQuarterRange } from "@/lib/quarter-range";

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
  const selected = resolveRequestedRange(params.from, params.to, fallback);
  const selectedFrom = selected.from;
  const selectedTo = selected.to;
  const currentMonth = new Date();
  const exportFrom = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const exportTo = format(endOfMonth(currentMonth), "yyyy-MM-dd");
  const currentQuarter = getCurrentQuarterRange();

  const [members, overview, quarterGoals] = await Promise.all([
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
    }),
    getGoalsForQuarterByMembers({
      organizationId: session.user.organizationId,
      quarterKey: currentQuarter.quarterKey
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

  const memberRows = members.map((member: any) => ({
    membershipId: member.id,
    name: member.user.name ?? member.user.email,
    email: member.user.email
  }));

  const goalsByMember = new Map<string, any[]>();
  for (const goal of quarterGoals) {
    const current = goalsByMember.get(goal.membershipId) ?? [];
    current.push(goal);
    goalsByMember.set(goal.membershipId, current);
  }

  const goalRows = memberRows.map((member: { membershipId: string; name: string; email: string }) => ({
    ...member,
    goals: (goalsByMember.get(member.membershipId) ?? []).map((goal: any) => ({
      id: goal.id,
      quarterKey: goal.quarterKey,
      title: goal.title,
      metric: goal.metric,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      actualValue: goal.actualValue ?? null,
      unit: goal.unit,
      status: goal.status ?? "in_progress",
      achievementStatus: goal.achievementStatus ?? null,
      evaluationNote: goal.evaluationNote ?? null,
      completedAt: goal.completedAt ?? null,
      completedByUserId: goal.completedByUserId ?? null,
      sortOrder: goal.sortOrder
    }))
  }));

  return (
    <div className="space-y-5">
      <AppNav role={session.user.role} user={session.user} />

      <AdminCollapsibleSection
        title="Weekly Employee Hours Report"
        description={`Daily hours and totals based on selected filter dates (${selectedFrom} to ${selectedTo}).`}
      >
        <div className="space-y-3">
          <DateRangePresetHeader initialFrom={selectedFrom} initialTo={selectedTo} weekStartsOn={normalizedWeekStart} />

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
        </div>
      </AdminCollapsibleSection>

      <AdminCollapsibleSection
        defaultOpen={false}
        title="People Time Tracking"
        description="Active organization members, roles, and monthly CSV export for the current month."
      >
        <div className="space-y-2">
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
        </div>
      </AdminCollapsibleSection>

      <AdminCollapsibleSection
        defaultOpen={false}
        title="Monthly Hours export"
        description="Download all employees monthly hour totals for the current month."
      >
        <ExportDownloadButton
          href={`/api/exports/payroll.csv?from=${exportFrom}&to=${exportTo}`}
          label="Download all employees monthly CSV"
        />
      </AdminCollapsibleSection>

      <AdminCollapsibleSection
        defaultOpen={false}
        title="Time off"
        description="Total requested days by employee. Open details to inspect the exact saved dates."
      >
        <AdminTimeOffSummary members={memberRows} />
      </AdminCollapsibleSection>

      <AdminCollapsibleSection
        defaultOpen={false}
        title="Invoices"
        description="Monthly invoice coverage by employee, including missing and uploaded PDF invoices."
      >
        <AdminInvoicesSummary members={memberRows} />
      </AdminCollapsibleSection>

      <AdminCollapsibleSection
        defaultOpen={false}
        title="Expenses"
        description="Monthly reimbursable expenses by employee, including totals owed and full receipt detail."
      >
        <AdminExpensesSummary members={memberRows} />
      </AdminCollapsibleSection>

      <AdminCollapsibleSection
        defaultOpen={false}
        title="Goals"
        description="Current-quarter goals by employee. Open a person to review targets and evaluations inside admin."
      >
        <AdminGoalsSummary
          quarterLabel={currentQuarter.label}
          quarterFrom={currentQuarter.from}
          quarterTo={currentQuarter.to}
          rows={goalRows}
          embedded
        />
      </AdminCollapsibleSection>
    </div>
  );
}
