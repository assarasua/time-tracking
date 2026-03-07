import { format } from "date-fns";

import { cn } from "@/lib/cn";

export type GoalView = {
  id: string;
  quarterKey: string;
  title: string;
  metric: string;
  targetValue: number;
  currentValue: number;
  actualValue: number | null;
  unit: string;
  status: "in_progress" | "completed";
  achievementStatus: "achieved" | "not_achieved" | null;
  evaluationNote: string | null;
  completedAt: string | Date | null;
  completedByUserId: string | null;
  sortOrder: number;
};

function formatGoalValue(value: number, unit: string) {
  if (Number.isInteger(value)) return `${value}${unit}`;
  return `${value.toFixed(1)}${unit}`;
}

function getEffectiveValue(goal: GoalView) {
  return goal.status === "completed" && goal.actualValue !== null ? goal.actualValue : goal.currentValue;
}

function getProgress(goal: GoalView) {
  if (goal.targetValue <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((getEffectiveValue(goal) / goal.targetValue) * 100)));
}

export function GoalsOverview({ goals, compact = false, showEvaluation = true }: { goals: GoalView[]; compact?: boolean; showEvaluation?: boolean; }) {
  if (!goals.length) {
    return <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">No quarterly goals have been configured yet.</div>;
  }

  return (
    <div className={cn("grid gap-3", compact ? "md:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2")}>
      {goals.map((goal) => {
        const progress = getProgress(goal);
        const isCompleted = goal.status === "completed";
        const isAchieved = goal.achievementStatus === "achieved";

        return (
          <div key={goal.id} className={cn("rounded-xl border p-4", isCompleted ? "border-success/40 bg-success/5" : "border-border bg-background")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{goal.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{goal.metric}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold", isCompleted ? "bg-success text-success-foreground" : progress >= 60 ? "bg-accent text-accent-foreground" : "bg-muted text-foreground")}>
                  {isCompleted ? "Completed" : `${progress}%`}
                </span>
                {showEvaluation && isCompleted && goal.achievementStatus ? (
                  <span className={cn("shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold", isAchieved ? "bg-primary text-primary-foreground" : "bg-destructive/15 text-destructive")}>
                    {isAchieved ? "Achieved" : "Not achieved"}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-[width] duration-300", isCompleted ? "bg-success" : "bg-primary")} style={{ width: `${progress}%` }} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Current: {formatGoalValue(goal.currentValue, goal.unit)}</span>
                <span>Target: {formatGoalValue(goal.targetValue, goal.unit)}</span>
              </div>
              {showEvaluation && goal.actualValue !== null ? <div className="text-xs text-muted-foreground">Final actual: {formatGoalValue(goal.actualValue, goal.unit)}</div> : null}
              {showEvaluation && goal.evaluationNote ? <div className="rounded-lg border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">{goal.evaluationNote}</div> : null}
              {showEvaluation && goal.completedAt ? <div className="text-xs text-muted-foreground">Reviewed on {format(new Date(goal.completedAt), "MMM d, yyyy")}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
