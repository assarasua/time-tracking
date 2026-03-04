"use client";

import { addWeeks, format, parseISO } from "date-fns";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type UserRole = "admin" | "employee";

type Session = {
  id: string;
  startAt: string;
  endAt: string | null;
  editReason?: string | null;
};

type DailySummary = {
  date: string;
  workedMinutes: number;
  sessions: Session[];
};

type WeekSummary = {
  weekStart: string;
  weekEnd: string;
  workedMinutes: number;
  expectedMinutes: number;
  varianceMinutes: number;
  weekLocked: boolean;
  daily: DailySummary[];
};

function formatMinutes(minutes: number) {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${hours}h ${mins}m`;
}

function asApiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const maybeError = (payload as { error?: unknown }).error;
  if (typeof maybeError === "string") return maybeError;
  return fallback;
}

function isCurrentWeek(weekStart: string, weekEnd: string) {
  const now = new Date();
  return now >= parseISO(weekStart) && now <= parseISO(weekEnd);
}

function AddHoursInlineForm({
  date,
  onSaved,
  onCancel,
  triggerRef
}: {
  date: string;
  onSaved: () => Promise<void>;
  onCancel: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitHours() {
    setError(null);

    if (!startTime || !endTime) {
      setError("Enter start time and end time.");
      return;
    }

    const startAt = new Date(`${date}T${startTime}:00`);
    const endAt = new Date(`${date}T${endTime}:00`);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      setError("Invalid date/time.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/time-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString()
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        throw new Error(asApiErrorMessage(payload, "Unable to save hours."));
      }

      await onSaved();
      triggerRef.current?.focus();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save hours.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-background p-3">
      {isSubmitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xs rounded-lg border border-border bg-card p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
              <p className="text-sm font-medium text-foreground">Processing hours...</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Start time</span>
          <Input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            aria-describedby={error ? `row-error-${date}` : undefined}
            autoFocus
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">End time</span>
          <Input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            aria-describedby={error ? `row-error-${date}` : undefined}
          />
        </label>
      </div>
      {error ? (
        <p id={`row-error-${date}`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button onClick={submitHours} disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? "Saving..." : "Save hours"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            onCancel();
            triggerRef.current?.focus();
          }}
          disabled={isSubmitting}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function TimesheetDayRow({
  role,
  item,
  weekLocked,
  isEditableWeek,
  isToday,
  targetMinutes,
  onSaved
}: {
  role: UserRole;
  item: DailySummary;
  weekLocked: boolean;
  isEditableWeek: boolean;
  isToday: boolean;
  targetMinutes: number;
  onSaved: () => Promise<void>;
}) {
  const [showSessions, setShowSessions] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);

  const canEdit = role === "admin" || (isEditableWeek && !weekLocked);
  const dayDate = parseISO(item.date);
  const dayLabel = format(dayDate, "EEE, MMM d");

  let statusLabel = "No hours";
  if (weekLocked && role !== "admin") {
    statusLabel = "Locked";
  } else if (item.workedMinutes > 0) {
    statusLabel = item.workedMinutes >= targetMinutes ? "Complete" : "Partial";
  }

  return (
    <div
      className={`space-y-3 rounded-lg border p-4 ${
        isToday ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border bg-card/95"
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{dayLabel}</p>
          <p className="text-xs text-muted-foreground">{formatMinutes(item.workedMinutes)} worked</p>
        </div>
        <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:flex-wrap lg:w-auto">
          <span
            className={`inline-flex h-9 items-center rounded-full px-3 text-xs font-semibold ${
              statusLabel === "Complete"
                ? "bg-success text-success-foreground"
                : statusLabel === "Locked"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {statusLabel}
          </span>
          <Button
            variant="ghost"
            onClick={() => setShowSessions((value) => !value)}
            aria-expanded={showSessions}
            aria-controls={`day-sessions-${item.date}`}
            className="w-full sm:w-auto"
          >
            {showSessions ? "Hide sessions" : "View sessions"}
          </Button>
          <Button
            ref={addButtonRef}
            variant="primary"
            onClick={() => setShowForm((value) => !value)}
            disabled={!canEdit}
            aria-expanded={showForm}
            aria-controls={`day-form-${item.date}`}
            title={!canEdit ? "Only admins or users in current unlocked week can add hours." : undefined}
            className="w-full sm:w-auto"
          >
            Add hours
          </Button>
        </div>
      </div>

      {showForm ? (
        <div id={`day-form-${item.date}`}>
          <AddHoursInlineForm
            date={item.date}
            onSaved={async () => {
              await onSaved();
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
            triggerRef={addButtonRef}
          />
        </div>
      ) : null}

      {showSessions ? (
        <div id={`day-sessions-${item.date}`} className="space-y-2">
          {item.sessions.length === 0 ? <p className="text-sm text-muted-foreground">No sessions for this day.</p> : null}
          {item.sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <span>{format(parseISO(session.startAt), "HH:mm")}</span>
              <span className="text-muted-foreground">
                {session.endAt ? format(parseISO(session.endAt), "HH:mm") : "Active"}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TimesheetBoard({ role, initialWeekStart }: { role: UserRole; initialWeekStart: string }) {
  const [selectedWeekStart, setSelectedWeekStart] = useState(initialWeekStart);
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [status, setStatus] = useState("Loading timesheet...");
  const [isLoading, setIsLoading] = useState(true);
  const [announce, setAnnounce] = useState("");

  async function loadWeek(weekStart: string) {
    setIsLoading(true);
    setStatus("Loading timesheet...");
    const response = await fetch(`/api/me/week-summary?week_start=${weekStart}`);
    if (!response.ok) {
      setStatus("Unable to load this week.");
      setIsLoading(false);
      return;
    }

    const data = (await response.json()) as WeekSummary;
    setSummary(data);
    setStatus("Ready");
    setIsLoading(false);
  }

  useEffect(() => {
    void loadWeek(selectedWeekStart);
  }, [selectedWeekStart]);

  const dayTargetMinutes = useMemo(() => {
    if (!summary) return 0;
    return Math.round(summary.expectedMinutes / 5);
  }, [summary]);

  const editableWeek = useMemo(() => {
    if (!summary) return false;
    return isCurrentWeek(summary.weekStart, summary.weekEnd);
  }, [summary]);

  function moveWeek(direction: "prev" | "next" | "current") {
    if (direction === "current") {
      const today = format(new Date(), "yyyy-MM-dd");
      setSelectedWeekStart(today);
      return;
    }

    const baseDate = parseISO(selectedWeekStart);
    const nextDate = direction === "prev" ? addWeeks(baseDate, -1) : addWeeks(baseDate, 1);
    setSelectedWeekStart(format(nextDate, "yyyy-MM-dd"));
  }

  return (
    <Card className="border-primary/20 bg-card/95 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Timesheet</CardTitle>
            <CardDescription>Review daily hours, weekly totals, and add manual entries.</CardDescription>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="ghost" onClick={() => moveWeek("prev")} className="w-full">
              Previous week
            </Button>
            <Button variant="ghost" onClick={() => moveWeek("current")} className="w-full">
              Current week
            </Button>
            <Button variant="ghost" onClick={() => moveWeek("next")} className="w-full">
              Next week
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Worked</p>
            <p className="mt-1 text-lg font-semibold">{formatMinutes(summary?.workedMinutes ?? 0)}</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected</p>
            <p className="mt-1 text-lg font-semibold">{formatMinutes(summary?.expectedMinutes ?? 0)}</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Variance</p>
            <p
              className={`mt-1 text-lg font-semibold ${
                (summary?.varianceMinutes ?? 0) < 0 ? "text-destructive" : "text-success-foreground"
              }`}
            >
              {formatMinutes(summary?.varianceMinutes ?? 0)}
            </p>
          </div>
        </div>
        <div className="rounded-md bg-accent/40 px-3 py-2 text-sm text-accent-foreground">{status}</div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
        {!isLoading && summary?.daily?.length ? (
          summary.daily.map((item) => (
            <TimesheetDayRow
              key={item.date}
              role={role}
              item={item}
              weekLocked={summary.weekLocked}
              isEditableWeek={editableWeek}
              isToday={item.date === format(new Date(), "yyyy-MM-dd")}
              targetMinutes={dayTargetMinutes}
              onSaved={async () => {
                await loadWeek(selectedWeekStart);
                setAnnounce(`Hours saved for ${item.date}.`);
              }}
            />
          ))
        ) : (
          <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
            No day data available for this week.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
