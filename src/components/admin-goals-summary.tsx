"use client";

import { useMemo, useState } from "react";
import type { MouseEvent } from "react";

import { AdminModalShell } from "@/components/admin-modal-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GoalsOverview, type GoalView } from "@/components/goals-overview";
import { cn } from "@/lib/cn";

type GoalSummaryRow = {
  membershipId: string;
  name: string;
  email: string;
  goals: GoalView[];
};

type GoalEvaluationForm = {
  actualValue: string;
  achievementStatus: "achieved" | "not_achieved" | "";
  evaluationNote: string;
};

function averageProgress(goals: GoalView[]) {
  const inProgressGoals = goals.filter((goal) => goal.status !== "completed");
  if (!inProgressGoals.length) return 0;
  const total = inProgressGoals.reduce((sum, goal) => {
    if (goal.targetValue <= 0) return sum;
    return sum + Math.max(0, Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)));
  }, 0);
  return Math.round(total / inProgressGoals.length);
}

function toEvaluationForms(goals: GoalView[]) {
  return goals.reduce<Record<string, GoalEvaluationForm>>((accumulator, goal) => {
    accumulator[goal.id] = {
      actualValue: goal.actualValue === null ? "" : String(goal.actualValue),
      achievementStatus: goal.achievementStatus ?? "",
      evaluationNote: goal.evaluationNote ?? ""
    };
    return accumulator;
  }, {});
}

export function AdminGoalsSummary({
  quarterLabel,
  quarterFrom,
  quarterTo,
  rows,
  embedded = false
}: {
  quarterLabel: string;
  quarterFrom: string;
  quarterTo: string;
  rows: GoalSummaryRow[];
  embedded?: boolean;
}) {
  const [rowsState, setRowsState] = useState(rows);
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);
  const [evaluationForms, setEvaluationForms] = useState<Record<string, GoalEvaluationForm>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingGoalId, setSavingGoalId] = useState<string | null>(null);
  const [modalAnchorTop, setModalAnchorTop] = useState(24);

  const selectedRow = useMemo(() => rowsState.find((row) => row.membershipId === selectedMembershipId) ?? null, [rowsState, selectedMembershipId]);

  function openRow(row: GoalSummaryRow, event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const viewportHeight = window.innerHeight;
    const nextTop = Math.min(Math.max(16, event.currentTarget.getBoundingClientRect().top - 24), Math.max(16, viewportHeight - 280));
    setModalAnchorTop(nextTop);
    setSelectedMembershipId(row.membershipId);
    setEvaluationForms(toEvaluationForms(row.goals));
    setStatus(null);
    setError(null);
  }

  function closeRow() {
    setSelectedMembershipId(null);
    setStatus(null);
    setError(null);
    setSavingGoalId(null);
  }

  function updateEvaluation(goalId: string, patch: Partial<GoalEvaluationForm>) {
    setEvaluationForms((current) => ({
      ...current,
      [goalId]: {
        actualValue: current[goalId]?.actualValue ?? "",
        achievementStatus: current[goalId]?.achievementStatus ?? "",
        evaluationNote: current[goalId]?.evaluationNote ?? "",
        ...patch
      }
    }));
  }

  async function saveEvaluation(goal: GoalView, nextStatus: "completed" | "in_progress") {
    setSavingGoalId(goal.id);
    setError(null);
    setStatus(nextStatus === "completed" ? "Saving evaluation..." : "Reopening goal...");

    try {
      const evaluation = evaluationForms[goal.id] ?? { actualValue: "", achievementStatus: "", evaluationNote: "" };
      const payload = {
        status: nextStatus,
        achievementStatus: nextStatus === "completed" && evaluation.achievementStatus ? evaluation.achievementStatus : null,
        actualValue: nextStatus === "completed" && evaluation.actualValue !== "" ? Number(evaluation.actualValue) : null,
        evaluationNote: evaluation.evaluationNote.trim() ? evaluation.evaluationNote.trim() : null
      };

      const response = await fetch(`/api/goals/${goal.id}/evaluation`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = (await response.json()) as { goal?: GoalView; error?: string | { fieldErrors?: Record<string, string[]>; formErrors?: string[] } };
      if (!response.ok || !result.goal) {
        const message =
          typeof result.error === "string"
            ? result.error
            : result.error?.fieldErrors?.actualValue?.[0] ?? result.error?.fieldErrors?.achievementStatus?.[0] ?? result.error?.formErrors?.[0] ?? "Unable to save goal evaluation.";
        throw new Error(message);
      }

      const updatedGoal = result.goal;
      setRowsState((currentRows) => currentRows.map((row) => row.membershipId === selectedMembershipId ? { ...row, goals: row.goals.map((currentGoal) => (currentGoal.id === goal.id ? updatedGoal : currentGoal)) } : row));
      setEvaluationForms((current) => ({
        ...current,
        [goal.id]: {
          actualValue: updatedGoal.actualValue === null ? "" : String(updatedGoal.actualValue),
          achievementStatus: updatedGoal.achievementStatus ?? "",
          evaluationNote: updatedGoal.evaluationNote ?? ""
        }
      }));
      setStatus(nextStatus === "completed" ? "Goal evaluation saved." : "Goal reopened.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save goal evaluation.");
      setStatus(null);
    } finally {
      setSavingGoalId(null);
    }
  }

  const content = (
    <>
      {selectedRow ? (
        <AdminModalShell
          title={selectedRow.name}
          subtitle={`${selectedRow.email} · ${quarterLabel} goals · ${quarterFrom} to ${quarterTo}`}
          onClose={closeRow}
          sizeClassName="max-w-6xl"
          anchorTop={modalAnchorTop}
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Goals</p><p className="mt-2 text-2xl font-semibold text-foreground">{selectedRow.goals.length}</p></div>
              <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p><p className="mt-2 text-2xl font-semibold text-success">{selectedRow.goals.filter((goal) => goal.status === "completed").length}</p></div>
              <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Achieved</p><p className="mt-2 text-2xl font-semibold text-primary">{selectedRow.goals.filter((goal) => goal.achievementStatus === "achieved").length}</p></div>
              <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Not achieved</p><p className="mt-2 text-2xl font-semibold text-destructive">{selectedRow.goals.filter((goal) => goal.achievementStatus === "not_achieved").length}</p></div>
            </div>

            {status ? <div className="rounded-md bg-accent/40 px-3 py-2 text-sm text-accent-foreground">{status}</div> : null}
            {error ? <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}

            <div className="space-y-3">
              {selectedRow.goals.map((goal) => {
                const evaluation = evaluationForms[goal.id] ?? { actualValue: "", achievementStatus: "", evaluationNote: "" };
                const isCompleted = goal.status === "completed";

                return (
                  <div key={goal.id} className={cn("rounded-xl border p-4", isCompleted ? "border-success/40 bg-success/5" : "border-border bg-background")}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 lg:max-w-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{goal.title}</p>
                          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", isCompleted ? "bg-success text-success-foreground" : "bg-muted text-foreground")}>{isCompleted ? "Completed" : "In progress"}</span>
                          {goal.achievementStatus ? <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", goal.achievementStatus === "achieved" ? "bg-primary text-primary-foreground" : "bg-destructive/15 text-destructive")}>{goal.achievementStatus === "achieved" ? "Achieved" : "Not achieved"}</span> : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{goal.metric}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>Current: {goal.currentValue}{goal.unit}</span>
                          <span>Target: {goal.targetValue}{goal.unit}</span>
                          {goal.actualValue !== null ? <span>Final actual: {goal.actualValue}{goal.unit}</span> : null}
                        </div>
                        {goal.completedAt ? <p className="mt-2 text-xs text-muted-foreground">Reviewed on {new Date(goal.completedAt).toLocaleDateString()}</p> : null}
                      </div>

                      <div className="grid flex-1 gap-3 md:grid-cols-2">
                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-foreground">Completion status</span>
                          <div className="flex h-10 items-center rounded-md border border-border bg-muted/30 px-3 text-sm text-foreground">{isCompleted ? "Completed" : "In progress"}</div>
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-foreground">Evaluation result</span>
                          <select
                            value={evaluation.achievementStatus}
                            onChange={(event) => updateEvaluation(goal.id, { achievementStatus: event.target.value as GoalEvaluationForm["achievementStatus"] })}
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <option value="">Select result</option>
                            <option value="achieved">Achieved</option>
                            <option value="not_achieved">Not achieved</option>
                          </select>
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-foreground">Final actual value</span>
                          <Input type="number" min="0" value={evaluation.actualValue} onChange={(event) => updateEvaluation(goal.id, { actualValue: event.target.value })} placeholder="Enter final value" />
                        </label>
                        <div className="hidden md:block" />
                        <label className="space-y-1 text-sm md:col-span-2">
                          <span className="font-medium text-foreground">Evaluation note</span>
                          <textarea value={evaluation.evaluationNote} onChange={(event) => updateEvaluation(goal.id, { evaluationNote: event.target.value })} placeholder="Short note on outcome, blockers, or context" className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                        </label>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      {isCompleted ? <Button type="button" variant="ghost" className="border border-border bg-background" disabled={savingGoalId === goal.id} onClick={() => void saveEvaluation(goal, "in_progress")}>{savingGoalId === goal.id ? "Saving..." : "Reopen"}</Button> : null}
                      <Button type="button" disabled={savingGoalId === goal.id} onClick={() => void saveEvaluation(goal, "completed")}>{savingGoalId === goal.id ? "Saving..." : isCompleted ? "Update evaluation" : "Mark completed"}</Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <GoalsOverview goals={selectedRow.goals} compact />
          </div>
        </AdminModalShell>
      ) : null}

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
          <p className="font-semibold text-foreground">{quarterLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">{quarterFrom} to {quarterTo}</p>
        </div>

        <div className="space-y-3">
          {rowsState.map((row) => {
            const completed = row.goals.filter((goal) => goal.status === "completed").length;
            const inProgress = row.goals.length - completed;
            const progress = averageProgress(row.goals);
            const achieved = row.goals.filter((goal) => goal.achievementStatus === "achieved").length;
            const notAchieved = row.goals.filter((goal) => goal.achievementStatus === "not_achieved").length;

            return (
              <div key={row.membershipId} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{row.goals.length ? `${row.goals.length} goals saved for this quarter.` : "No goals configured for this quarter yet."}</p>
                  </div>

                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">{row.goals.length ? `${completed} completed · ${inProgress} in progress` : "Missing goals"}</span>
                    <Button type="button" variant="ghost" className="border border-border bg-background" onClick={(event) => openRow(row, event)}>Open goals</Button>
                  </div>
                </div>

                {row.goals.length ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-5">
                    <div className="rounded-lg border border-border bg-card/60 p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p><p className="mt-2 text-xl font-semibold text-success">{completed}</p></div>
                    <div className="rounded-lg border border-border bg-card/60 p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">In progress</p><p className="mt-2 text-xl font-semibold text-foreground">{inProgress}</p></div>
                    <div className="rounded-lg border border-border bg-card/60 p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Achieved</p><p className="mt-2 text-xl font-semibold text-primary">{achieved}</p></div>
                    <div className="rounded-lg border border-border bg-card/60 p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Not achieved</p><p className="mt-2 text-xl font-semibold text-destructive">{notAchieved}</p></div>
                    <div className="rounded-lg border border-border bg-card/60 p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Avg progress</p><p className="mt-2 text-xl font-semibold text-foreground">{progress}%</p></div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Goals</CardTitle>
        <CardDescription>Current-quarter goals by employee. Open a person to review targets and evaluations inside admin.</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
