import Link from "next/link";

import { GoalsOverview } from "@/components/goals-overview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getGoalsForQuarter } from "@/lib/goals";
import { getCurrentQuarterRange } from "@/lib/quarter-range";

export async function GoalsSummaryCard({
  organizationId,
  organizationUserId,
  heading = "Quarter goals",
  description,
  compact = true,
  openHref = "/goals"
}: {
  organizationId: string;
  organizationUserId: string;
  heading?: string;
  description?: string;
  compact?: boolean;
  openHref?: string;
}) {
  const currentQuarter = getCurrentQuarterRange();
  const goals = await getGoalsForQuarter({
    organizationId,
    organizationUserId,
    quarterKey: currentQuarter.quarterKey
  });

  const completedGoals = goals.filter((goal) => goal.status === "completed").length;
  const inProgressGoals = goals.length - completedGoals;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{heading}</CardTitle>
            <CardDescription>{description ?? `Quarterly KPI targets for ${currentQuarter.label}.`}</CardDescription>
          </div>
          <Link
            href={openHref}
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Open goals
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
          <p className="font-semibold text-foreground">{currentQuarter.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {currentQuarter.from} to {currentQuarter.to}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Goals</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{goals.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
            <p className="mt-2 text-2xl font-semibold text-success">{completedGoals}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">In progress</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{inProgressGoals}</p>
          </div>
        </div>

        <GoalsOverview goals={goals} compact={compact} />
      </CardContent>
    </Card>
  );
}
