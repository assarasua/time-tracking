"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";

import { GoalsOverview, type GoalView } from "@/components/goals-overview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  getCurrentQuarterRange,
  getNextQuarterRange,
  getPreviousQuarterRange,
  getQuarterModeLabel,
  getRangeForQuarter,
  listQuarterOptions,
  type QuarterSelectionMode
} from "@/lib/quarter-range";

type GoalForm = {
  title: string;
  metric: string;
  targetValue: string;
  currentValue: string;
  unit: string;
};

type GoalEvaluationForm = {
  actualValue: string;
  evaluationNote: string;
};

type MemberOption = {
  membershipId: string;
  name: string;
  email: string;
};

const PRESETS: Array<Exclude<QuarterSelectionMode, "custom">> = ["previous", "current", "next"];

function emptyGoal(): GoalForm {
  return {
    title: "",
    metric: "",
    targetValue: "",
    currentValue: "",
    unit: "%"
  };
}

function toFormGoals(goals: GoalView[]) {
  return goals.length
    ? goals.map((goal) => ({
        title: goal.title,
        metric: goal.metric,
        targetValue: String(goal.targetValue),
        currentValue: String(goal.currentValue),
        unit: goal.unit
      }))
    : Array.from({ length: 3 }, () => emptyGoal());
}

function toEvaluationForms(goals: GoalView[]) {
  return goals.reduce<Record<string, GoalEvaluationForm>>((accumulator, goal) => {
    accumulator[goal.id] = {
      actualValue: goal.actualValue === null ? "" : String(goal.actualValue),
      evaluationNote: goal.evaluationNote ?? ""
    };
    return accumulator;
  }, {});
}

export function GoalsBoard({
  role,
  members,
  currentMembershipId
}: {
  role: "admin" | "employee";
  members: MemberOption[];
  currentMembershipId: string;
}) {
  const currentQuarter = getCurrentQuarterRange();
  const [quarter, setQuarter] = useState(currentQuarter.quarterKey);
  const [mode, setMode] = useState<QuarterSelectionMode>("current");
  const [selectedMembershipId, setSelectedMembershipId] = useState(currentMembershipId);
  const [goals, setGoals] = useState<GoalView[]>([]);
  const [formGoals, setFormGoals] = useState<GoalForm[]>(Array.from({ length: 3 }, () => emptyGoal()));
  const [evaluationForms, setEvaluationForms] = useState<Record<string, GoalEvaluationForm>>({});
  const [status, setStatus] = useState("Loading quarterly goals...");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingEvaluationId, setSavingEvaluationId] = useState<string | null>(null);

  const quarterRange = useMemo(() => getRangeForQuarter(quarter), [quarter]);
  const quarterOptions = useMemo(() => listQuarterOptions(), []);
  const canEditPlanning = true;
  const canEvaluate = role === "admin";
  const selectedMember = useMemo(
    () => members.find((member) => member.membershipId === selectedMembershipId) ?? members[0],
    [members, selectedMembershipId]
  );
  const completedCount = useMemo(() => goals.filter((goal) => goal.status === "completed").length, [goals]);
  const inProgressCount = goals.length - completedCount;

  async function loadGoals(targetQuarter = quarter, targetMembershipId = selectedMembershipId) {
    setError(null);
    setStatus("Loading quarterly goals...");
    try {
      const search = new URLSearchParams({ quarter: targetQuarter, membership_id: targetMembershipId });
      const response = await fetch(`/api/goals?${search.toString()}`, {
        cache: "no-store",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Unable to load quarterly goals.");
      }

      const payload = (await response.json()) as { goals: GoalView[] };
      setGoals(payload.goals);
      setFormGoals(toFormGoals(payload.goals));
      setEvaluationForms(toEvaluationForms(payload.goals));
      setStatus(
        payload.goals.length
          ? `Showing ${payload.goals.length} goals for ${selectedMember?.name ?? "this employee"} in ${targetQuarter}.`
          : `No goals configured for ${selectedMember?.name ?? "this employee"} in ${targetQuarter}.`
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load quarterly goals.");
      setStatus("Quarterly goals are unavailable.");
    }
  }

  useEffect(() => {
    void loadGoals(quarter, selectedMembershipId);
  }, [quarter, selectedMembershipId]);

  function applyPreset(nextMode: Exclude<QuarterSelectionMode, "custom">) {
    const nextRange = nextMode === "previous" ? getPreviousQuarterRange() : nextMode === "next" ? getNextQuarterRange() : getCurrentQuarterRange();
    setMode(nextMode);
    setQuarter(nextRange.quarterKey);
  }

  function applyCustomQuarter(nextQuarter: string) {
    if (!nextQuarter) return;
    setMode("custom");
    setQuarter(nextQuarter);
  }

  function updateGoal(index: number, patch: Partial<GoalForm>) {
    setFormGoals((currentGoals) => currentGoals.map((goal, goalIndex) => (goalIndex === index ? { ...goal, ...patch } : goal)));
  }

  function updateEvaluation(goalId: string, patch: Partial<GoalEvaluationForm>) {
    setEvaluationForms((current) => ({
      ...current,
      [goalId]: {
        actualValue: current[goalId]?.actualValue ?? "",
        evaluationNote: current[goalId]?.evaluationNote ?? "",
        ...patch
      }
    }));
  }

  function addGoalRow() {
    setFormGoals((currentGoals) => (currentGoals.length >= 5 ? currentGoals : [...currentGoals, emptyGoal()]));
  }

  function removeGoalRow(index: number) {
    setFormGoals((currentGoals) => (currentGoals.length <= 3 ? currentGoals : currentGoals.filter((_, goalIndex) => goalIndex !== index)));
  }

  async function saveGoals() {
    setIsSaving(true);
    setError(null);
    setStatus("Saving quarterly goals...");
    try {
      const payload = {
        quarter,
        membership_id: selectedMembershipId,
        goals: formGoals.map((goal) => ({
          title: goal.title.trim(),
          metric: goal.metric.trim(),
          targetValue: Number(goal.targetValue),
          currentValue: Number(goal.currentValue),
          unit: goal.unit.trim()
        }))
      };

      const response = await fetch("/api/goals", {
        method: "PUT",
        credentials: "include",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = (await response.json()) as { goals?: GoalView[]; error?: string | { fieldErrors?: Record<string, string[]>; formErrors?: string[] } };
      if (!response.ok || !result.goals) {
        const message =
          typeof result.error === "string"
            ? result.error
            : result.error?.formErrors?.[0] ?? "Unable to save quarterly goals.";
        throw new Error(message);
      }

      setGoals(result.goals);
      setFormGoals(toFormGoals(result.goals));
      setEvaluationForms(toEvaluationForms(result.goals));
      setStatus(`Saved ${result.goals.length} goals for ${selectedMember?.name ?? "this employee"} in ${quarter}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save quarterly goals.");
      setStatus("Quarterly goals were not saved.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEvaluation(goal: GoalView, nextStatus: "completed" | "in_progress") {
    setSavingEvaluationId(goal.id);
    setError(null);
    setStatus(nextStatus === "completed" ? "Saving goal evaluation..." : "Reopening goal...");
    try {
      const evaluation = evaluationForms[goal.id] ?? { actualValue: "", evaluationNote: "" };
      const payload = {
        status: nextStatus,
        actualValue: nextStatus === "completed" && evaluation.actualValue !== "" ? Number(evaluation.actualValue) : null,
        evaluationNote: evaluation.evaluationNote.trim() ? evaluation.evaluationNote.trim() : null
      };

      const response = await fetch(`/api/goals/${goal.id}/evaluation`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = (await response.json()) as { goal?: GoalView; error?: string | { fieldErrors?: Record<string, string[]>; formErrors?: string[] } };
      if (!response.ok || !result.goal) {
        const message =
          typeof result.error === "string"
            ? result.error
            : result.error?.fieldErrors?.actualValue?.[0] ?? result.error?.formErrors?.[0] ?? "Unable to save goal evaluation.";
        throw new Error(message);
      }

      setGoals((currentGoals) => currentGoals.map((currentGoal) => (currentGoal.id === goal.id ? result.goal! : currentGoal)));
      setEvaluationForms((current) => ({
        ...current,
        [goal.id]: {
          actualValue: result.goal?.actualValue === null || result.goal?.actualValue === undefined ? "" : String(result.goal.actualValue),
          evaluationNote: result.goal?.evaluationNote ?? ""
        }
      }));
      setStatus(nextStatus === "completed" ? `Goal marked completed for ${selectedMember?.name ?? "this employee"}.` : `Goal reopened for ${selectedMember?.name ?? "this employee"}.`);
    } catch (evaluationError) {
      setError(evaluationError instanceof Error ? evaluationError.message : "Unable to save goal evaluation.");
      setStatus("Goal evaluation was not saved.");
    } finally {
      setSavingEvaluationId(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Goals</CardTitle>
          <CardDescription>
            {canEvaluate
              ? "Assign 3-5 quarterly goals per employee, track live progress, and record the final evaluation when the goal is completed."
              : "Set your own quarterly goals, keep progress updated, and review final evaluations once they are completed."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
            {canEvaluate ? (
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-foreground">Employee</span>
                <select
                  value={selectedMembershipId}
                  onChange={(event) => setSelectedMembershipId(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {members.map((member) => (
                    <option key={member.membershipId} value={member.membershipId}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                <p className="font-semibold text-foreground">{selectedMember?.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{selectedMember?.email}</p>
              </div>
            )}

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-muted/90 to-transparent sm:hidden" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-muted/90 to-transparent sm:hidden" />
              <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Quarter presets">
                <div className="inline-flex min-w-max snap-x snap-mandatory items-center gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      aria-pressed={mode === preset}
                      className={cn(
                        "inline-flex h-9 shrink-0 snap-start items-center rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        mode === preset ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      {getQuarterModeLabel(preset)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMode("custom")}
                    aria-pressed={mode === "custom"}
                    className={cn(
                      "inline-flex h-9 shrink-0 snap-start items-center rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      mode === "custom" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    Custom quarter
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
              <p className="font-semibold text-foreground">{quarterRange.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{quarterRange.from} to {quarterRange.to}</p>
            </div>

            {mode === "custom" ? (
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-foreground">Quarter</span>
                <select
                  value={quarter}
                  onChange={(event) => applyCustomQuarter(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {quarterOptions.map((option) => (
                    <option key={option.quarterKey} value={option.quarterKey}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="rounded-md bg-accent/40 px-3 py-2 text-sm text-accent-foreground" aria-live="polite">
            {status}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Goals</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{goals.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
          <p className="mt-2 text-2xl font-semibold text-success">{completedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">In progress</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{inProgressCount}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{selectedMember?.name ?? "Employee"} · {quarterRange.label}</CardTitle>
          <CardDescription>Current progress and final evaluations for the saved quarterly KPI targets.</CardDescription>
        </CardHeader>
        <CardContent>
          <GoalsOverview goals={goals} />
        </CardContent>
      </Card>

      {canEditPlanning ? (
        <Card>
          <CardHeader>
            <CardTitle>Planning and evaluation</CardTitle>
            <CardDescription>
              {canEvaluate
                ? "Update planning fields at the top of each card. Use the evaluation panel to complete or reopen an individual goal."
                : "Update your planning fields at the top of each card. Final evaluation stays visible here once an admin completes the review."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {formGoals.map((goal, index) => {
                const savedGoal = goals[index];
                const evaluation = savedGoal ? evaluationForms[savedGoal.id] ?? { actualValue: "", evaluationNote: "" } : { actualValue: "", evaluationNote: "" };
                const isCompleted = savedGoal?.status === "completed";

                return (
                  <div key={`${selectedMembershipId}-${quarter}-${index}`} className="rounded-xl border border-border bg-background p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">Goal {index + 1}</p>
                      <div className="flex items-center gap-3">
                        {savedGoal ? (
                          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", isCompleted ? "bg-success text-success-foreground" : "bg-muted text-foreground")}>
                            {isCompleted ? "Completed" : "In progress"}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeGoalRow(index)}
                          disabled={formGoals.length <= 3}
                          className="text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:text-muted-foreground"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-foreground">Goal title</span>
                        <Input value={goal.title} onChange={(event) => updateGoal(index, { title: event.target.value })} placeholder="Increase client retention" />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-foreground">KPI description</span>
                        <Input value={goal.metric} onChange={(event) => updateGoal(index, { metric: event.target.value })} placeholder="Active customers retained by quarter end" />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-foreground">Current value</span>
                        <Input type="number" min="0" value={goal.currentValue} onChange={(event) => updateGoal(index, { currentValue: event.target.value })} />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-foreground">Target value</span>
                        <Input type="number" min="0" value={goal.targetValue} onChange={(event) => updateGoal(index, { targetValue: event.target.value })} />
                      </label>
                      <label className="space-y-1 text-sm md:col-span-2">
                        <span className="font-medium text-foreground">Unit</span>
                        <Input value={goal.unit} onChange={(event) => updateGoal(index, { unit: event.target.value })} placeholder="%, hrs, leads, deals" />
                      </label>
                    </div>

                    {savedGoal ? (
                      <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">Evaluation</p>
                            <p className="text-xs text-muted-foreground">
                              {canEvaluate
                                ? "Set the final achieved value and close the goal when the review is complete."
                                : "This section becomes read-only once the goal has been reviewed."}
                            </p>
                          </div>
                          {savedGoal.completedAt ? (
                            <p className="text-xs text-muted-foreground">Reviewed on {format(new Date(savedGoal.completedAt), "MMM d, yyyy")}</p>
                          ) : null}
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <label className="space-y-1 text-sm">
                            <span className="font-medium text-foreground">Final actual value</span>
                            <Input
                              type="number"
                              min="0"
                              value={evaluation.actualValue}
                              onChange={(event) => updateEvaluation(savedGoal.id, { actualValue: event.target.value })}
                              placeholder="Enter final achieved result"
                              disabled={!canEvaluate}
                            />
                          </label>
                          <label className="space-y-1 text-sm md:col-span-2">
                            <span className="font-medium text-foreground">Evaluation note</span>
                            <textarea
                              value={evaluation.evaluationNote}
                              onChange={(event) => updateEvaluation(savedGoal.id, { evaluationNote: event.target.value })}
                              placeholder="Short note on blockers, context, or final outcome"
                              disabled={!canEvaluate}
                              className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                            />
                          </label>
                        </div>
                        {canEvaluate ? (
                          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                            {isCompleted ? (
                              <Button
                                type="button"
                                variant="ghost"
                                className="border border-border bg-background"
                                disabled={savingEvaluationId === savedGoal.id}
                                onClick={() => void saveEvaluation(savedGoal, "in_progress")}
                              >
                                {savingEvaluationId === savedGoal.id ? "Saving..." : "Reopen"}
                              </Button>
                            ) : (
                              <Button type="button" disabled={savingEvaluationId === savedGoal.id} onClick={() => void saveEvaluation(savedGoal, "completed")}>
                                {savingEvaluationId === savedGoal.id ? "Saving..." : "Mark completed"}
                              </Button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        Save the quarterly goals first before the review section can be used.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="ghost" className="border border-border bg-background" onClick={addGoalRow} disabled={formGoals.length >= 5}>
                Add goal
              </Button>
              <Button type="button" onClick={() => void saveGoals()} disabled={isSaving}>
                {isSaving ? "Saving..." : `Save ${selectedMember?.name ?? "employee"} goals`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
