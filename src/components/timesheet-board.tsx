"use client";

import { addDays, addWeeks, endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { DateRangePresetHeader } from "@/components/date-range-preset-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { detectSelectionMode, getModeLabel } from "@/lib/date-range";

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
  weekLocked?: boolean;
};

type WeekSummaryResponse = {
  weekStart: string;
  weekEnd: string;
  workedMinutes: number;
  expectedMinutes: number;
  varianceMinutes: number;
  weekLocked: boolean;
  daily: DailySummary[];
};

type RangeSummary = {
  from: string;
  to: string;
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

const californiaTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function formatCaliforniaTime(value: string) {
  return californiaTimeFormatter.format(parseISO(value));
}

const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hour = Math.floor(index / 4);
  const minute = (index % 4) * 15;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});

function buildUtcDate(date: string, time: string) {
  const [yearStr, monthStr, dayStr] = date.split("-");
  const [hourStr, minuteStr] = time.split(":");

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return new Date(NaN);
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
}

function asApiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const maybeError = (payload as { error?: unknown }).error;
  if (typeof maybeError === "string") return maybeError;
  return fallback;
}

function isCurrentWeekByDate(dateStr: string) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const target = parseISO(dateStr);
  return target >= weekStart && target <= weekEnd;
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

    const startAt = buildUtcDate(date, startTime);
    const endAt = buildUtcDate(date, endTime);
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
          <select
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            aria-describedby={error ? `row-error-${date}` : undefined}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            autoFocus
          >
            <option value="">Select start</option>
            {TIME_OPTIONS.map((timeValue) => (
              <option key={`start-${timeValue}`} value={timeValue}>
                {timeValue}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">End time</span>
          <select
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            aria-describedby={error ? `row-error-${date}` : undefined}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Select end</option>
            {TIME_OPTIONS.map((timeValue) => (
              <option key={`end-${timeValue}`} value={timeValue}>
                {timeValue}
              </option>
            ))}
          </select>
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
  isToday,
  targetMinutes,
  onSaved
}: {
  role: UserRole;
  item: DailySummary;
  isToday: boolean;
  targetMinutes: number;
  onSaved: () => Promise<void>;
}) {
  const [showSessions, setShowSessions] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);

  const canEdit = role === "admin" || (isCurrentWeekByDate(item.date) && !item.weekLocked);
  const dayDate = parseISO(item.date);
  const dayLabel = format(dayDate, "EEE, MMM d");

  let statusLabel = "No hours";
  if (item.weekLocked && role !== "admin") {
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
              <span>{formatCaliforniaTime(session.startAt)}</span>
              <span className="text-muted-foreground">
                {session.endAt ? formatCaliforniaTime(session.endAt) : "Active"}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TimesheetBoard({
  role,
  initialFrom,
  initialTo
}: {
  role: UserRole;
  initialFrom: string;
  initialTo: string;
}) {
  const [selectedFrom, setSelectedFrom] = useState(initialFrom);
  const [selectedTo, setSelectedTo] = useState(initialTo);
  const [summary, setSummary] = useState<RangeSummary | null>(null);
  const [status, setStatus] = useState("Loading range...");
  const [isLoading, setIsLoading] = useState(true);
  const [announce, setAnnounce] = useState("");

  async function loadRange(from: string, to: string) {
    const fromDate = parseISO(from);
    const toDate = parseISO(to);
    const normalizedToDate = toDate < fromDate ? fromDate : toDate;

    const weekStarts: string[] = [];
    let cursor = startOfWeek(fromDate, { weekStartsOn: 1 });
    const endWeek = startOfWeek(normalizedToDate, { weekStartsOn: 1 });
    while (cursor <= endWeek) {
      weekStarts.push(format(cursor, "yyyy-MM-dd"));
      cursor = addWeeks(cursor, 1);
    }

    setIsLoading(true);
    setStatus("Loading range...");

    const results = await Promise.all(
      weekStarts.map(async (weekStart) => {
        const response = await fetch(`/api/me/week-summary?week_start=${weekStart}`);
        if (!response.ok) return null;
        return (await response.json()) as WeekSummaryResponse;
      })
    );

    const validResults = results.filter((item): item is WeekSummaryResponse => Boolean(item));
    if (validResults.length === 0) {
      setStatus("Unable to load selected range.");
      setIsLoading(false);
      return;
    }

    const fromKey = format(fromDate, "yyyy-MM-dd");
    const toKey = format(normalizedToDate, "yyyy-MM-dd");

    let workedMinutes = 0;
    let expectedMinutes = 0;
    let anyLockedWeek = false;

    const daily = validResults
      .flatMap((week) => {
        anyLockedWeek = anyLockedWeek || week.weekLocked;
        const expectedPerBusinessDay = Math.round(week.expectedMinutes / 5);

        return week.daily
          .filter((day) => day.date >= fromKey && day.date <= toKey)
          .map((day) => {
            const businessDay = (() => {
              const dow = parseISO(day.date).getUTCDay();
              return dow >= 1 && dow <= 5;
            })();
            if (businessDay) {
              expectedMinutes += expectedPerBusinessDay;
            }
            workedMinutes += day.workedMinutes;
            return {
              ...day,
              weekLocked: week.weekLocked
            };
          });
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    setSummary({
      from: fromKey,
      to: toKey,
      workedMinutes,
      expectedMinutes,
      varianceMinutes: workedMinutes - expectedMinutes,
      weekLocked: anyLockedWeek,
      daily
    });
    setStatus("Ready");
    setIsLoading(false);
  }

  useEffect(() => {
    void loadRange(selectedFrom, selectedTo);
  }, [selectedFrom, selectedTo]);

  const dayTargetMinutes = useMemo(() => {
    if (!summary) return 0;
    return Math.round(summary.expectedMinutes / 5);
  }, [summary]);

  const selectionLabel = useMemo(() => {
    return getModeLabel(detectSelectionMode(selectedFrom, selectedTo, 1));
  }, [selectedFrom, selectedTo]);

  return (
    <Card className="border-primary/20 bg-card/95 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-xl sm:text-2xl">Timesheet</CardTitle>
            <CardDescription>Review daily hours, selected-range totals, and add manual entries.</CardDescription>
          </div>
        </div>
        <DateRangePresetHeader
          initialFrom={selectedFrom}
          initialTo={selectedTo}
          weekStartsOn={1}
          onApply={({ from, to }) => {
            setSelectedFrom(from);
            setSelectedTo(to);
          }}
        />

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <span className="font-semibold text-foreground">Selection:</span>{" "}
          <span className="text-muted-foreground">{selectionLabel}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
        {!isLoading && summary?.daily?.length ? (
          <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1">
            <div className="sticky top-0 z-10 rounded-md border border-border bg-card/95 px-3 py-2 text-sm backdrop-blur">
              <span className="font-semibold text-foreground">{selectionLabel}</span>
              <span className="ml-2 text-muted-foreground">
                ({selectedFrom} to {selectedTo})
              </span>
            </div>
            {summary.daily.map((item) => (
              <TimesheetDayRow
                key={item.date}
                role={role}
                item={item}
                isToday={item.date === format(new Date(), "yyyy-MM-dd")}
                targetMinutes={dayTargetMinutes}
                onSaved={async () => {
                  await loadRange(selectedFrom, selectedTo);
                  setAnnounce(`Hours saved for ${item.date}.`);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
            No day data available for the selected range.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
