"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths
} from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { GoogleCalendarSyncCard, type CalendarSyncStatus } from "@/components/google-calendar-sync-card";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCaliforniaPublicHolidaysByDate } from "@/lib/california-holidays";
import { cn } from "@/lib/cn";
import { formatDateOnly } from "@/lib/date-only";

type TimeOffType = "vacation" | "unpaid_leave" | "not_working";
type TimeOffStatus = "approved";
type MonthMode = "previous" | "current" | "next" | "custom";

type TimeOffEntry = {
  id: string;
  date: string;
  type: TimeOffType | "pto";
  status: TimeOffStatus;
};

type TimeOffResponse = {
  entries: TimeOffEntry[];
};

const TYPE_OPTIONS: Array<{
  value: TimeOffType;
  label: string;
  hint: string;
  chipClass: string;
  calendarClass: string;
  calendarTextClass: string;
}> = [
  {
    value: "vacation",
    label: "Vacation",
    hint: "Planned days away",
    chipClass: "bg-primary text-primary-foreground",
    calendarClass: "border-primary/50 bg-primary/12",
    calendarTextClass: "text-foreground"
  },
  {
    value: "unpaid_leave",
    label: "Unpaid leave",
    hint: "Leave without pay",
    chipClass: "bg-accent text-accent-foreground",
    calendarClass: "border-accent/60 bg-accent/20",
    calendarTextClass: "text-foreground"
  },
  {
    value: "not_working",
    label: "Not working",
    hint: "Unavailable or not scheduled",
    chipClass: "bg-secondary text-secondary-foreground",
    calendarClass: "border-secondary/60 bg-secondary/20",
    calendarTextClass: "text-foreground"
  }
];

function monthRange(base: Date) {
  const monthStart = startOfMonth(base);
  const monthEnd = endOfMonth(base);
  return {
    from: format(monthStart, "yyyy-MM-dd"),
    to: format(monthEnd, "yyyy-MM-dd"),
    visibleMonth: monthStart
  };
}

function getPresetRange(mode: Exclude<MonthMode, "custom">) {
  const now = startOfMonth(new Date());
  if (mode === "previous") return monthRange(subMonths(now, 1));
  if (mode === "next") return monthRange(addMonths(now, 1));
  return monthRange(now);
}

function detectMode(from: string, to: string): MonthMode {
  const current = getPresetRange("current");
  const previous = getPresetRange("previous");
  const next = getPresetRange("next");
  if (from === current.from && to === current.to) return "current";
  if (from === previous.from && to === previous.to) return "previous";
  if (from === next.from && to === next.to) return "next";
  return "custom";
}

function modeLabel(mode: MonthMode) {
  if (mode === "previous") return "Previous month";
  if (mode === "next") return "Next month";
  if (mode === "current") return "Current month";
  return "Custom date";
}

function calendarBounds(visibleMonth: Date) {
  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  return {
    from: format(startOfWeek(monthStart, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    to: format(endOfWeek(monthEnd, { weekStartsOn: 1 }), "yyyy-MM-dd")
  };
}

function sameDraft(a: Map<string, TimeOffType>, b: Map<string, TimeOffType>) {
  if (a.size !== b.size) return false;
  for (const [date, type] of a) {
    if (b.get(date) !== type) return false;
  }
  return true;
}

function typeMeta(type: TimeOffType) {
  return TYPE_OPTIONS.find((option) => option.value === type) ?? TYPE_OPTIONS[0];
}

type DayState = {
  dayKey: string;
  entryType?: TimeOffType;
  saved: boolean;
  holidayName?: string;
  inVisibleMonth: boolean;
  isPastDay: boolean;
  isWeekend: boolean;
  isBlockedDay: boolean;
  meta: ReturnType<typeof typeMeta> | null;
};

export function TimeOffBoard() {
  const current = getPresetRange("current");
  const [selectedFrom, setSelectedFrom] = useState(current.from);
  const [selectedTo, setSelectedTo] = useState(current.to);
  const [mode, setMode] = useState<MonthMode>("current");
  const [visibleMonth, setVisibleMonth] = useState(current.visibleMonth);
  const [customMonth, setCustomMonth] = useState(format(current.visibleMonth, "yyyy-MM"));
  const [activeType, setActiveType] = useState<TimeOffType>("vacation");
  const [savedEntries, setSavedEntries] = useState<TimeOffEntry[]>([]);
  const [draftEntries, setDraftEntries] = useState<Map<string, TimeOffType>>(new Map());
  const [status, setStatus] = useState("Loading time off...");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingHolidays, setIsSyncingHolidays] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [calendarSyncStatus, setCalendarSyncStatus] = useState<CalendarSyncStatus>("not_connected");
  const searchParams = useSearchParams();

  const calendarRange = useMemo(() => calendarBounds(visibleMonth), [visibleMonth]);
  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({
        start: parseISO(calendarRange.from),
        end: parseISO(calendarRange.to)
      }),
    [calendarRange.from, calendarRange.to]
  );

  const savedByDate = useMemo(() => new Map(savedEntries.map((entry) => [entry.date, entry])), [savedEntries]);
  const savedDraft = useMemo(
    () =>
      new Map(
        savedEntries.map((entry) => [entry.date, entry.type === "pto" ? "unpaid_leave" : entry.type] as [string, TimeOffType])
      ),
    [savedEntries]
  );
  const hasChanges = useMemo(() => !sameDraft(savedDraft, draftEntries), [savedDraft, draftEntries]);
  const californiaHolidays = useMemo(
    () => getCaliforniaPublicHolidaysByDate(calendarRange.from, calendarRange.to),
    [calendarRange.from, calendarRange.to]
  );

  const monthLabel = useMemo(() => format(visibleMonth, "MMMM yyyy"), [visibleMonth]);
  const selectedLabel = useMemo(() => modeLabel(mode), [mode]);
  const selectedRangeDaysTaken = useMemo(() => savedEntries.length, [savedEntries]);
  const selectedRangePendingChanges = useMemo(() => draftEntries.size, [draftEntries]);
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const upcomingEntries = useMemo(() => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    return [...savedEntries]
      .filter((entry) => entry.date >= todayKey)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);
  }, [savedEntries]);
  const visibleMonthDays = useMemo(() => calendarDays.filter((day) => isSameMonth(day, visibleMonth)), [calendarDays, visibleMonth]);

  async function loadEntries(from = selectedFrom, to = selectedTo) {
    setIsLoading(true);
    setStatus("Loading time off...");

    try {
      const response = await fetch(`/api/time-off?from=${from}&to=${to}`, {
        cache: "no-store",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Unable to load time off.");
      }

      const payload = (await response.json()) as TimeOffResponse;
      setSavedEntries(payload.entries);
      setDraftEntries(
        new Map(
          payload.entries.map((entry) => [entry.date, entry.type === "pto" ? "unpaid_leave" : entry.type]) as Array<
            [string, TimeOffType]
          >
        )
      );
      setStatus("Select a day type, click dates in the calendar, then save. California public holidays are shown automatically.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load time off.");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveSelection() {
    if (!hasChanges || isSaving) return;

    const entries = [...draftEntries.entries()].map(([date, type]) => ({ date, type }));

    setIsSaving(true);
    setStatus("Saving approved time off...");

    try {
      const createResponse = await fetch("/api/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          from: selectedFrom,
          to: selectedTo,
          entries
        })
      });

      if (!createResponse.ok) {
        throw new Error("Unable to save selected day types.");
      }

      await loadEntries();
      setAnnounce("Time off saved.");
      if (calendarSyncStatus === "not_connected") {
        setStatus("Time off saved in the app. Google Calendar sync is not active.");
      } else if (calendarSyncStatus === "connected") {
        setStatus("Time off saved and Google Calendar sync updated.");
      } else {
        setStatus("Time off saved in the app. Google Calendar sync needs attention.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save time off.");
    } finally {
      setIsSaving(false);
    }
  }

  function applyPreset(nextMode: Exclude<MonthMode, "custom">) {
    const range = getPresetRange(nextMode);
    setMode(nextMode);
    setSelectedFrom(range.from);
    setSelectedTo(range.to);
    setVisibleMonth(range.visibleMonth);
    setCustomMonth(format(range.visibleMonth, "yyyy-MM"));
  }

  function applyCustomMonth(monthValue: string) {
    if (!monthValue) return;
    const nextVisibleMonth = startOfMonth(parseISO(`${monthValue}-01`));
    const nextRange = monthRange(nextVisibleMonth);
    setMode("custom");
    setVisibleMonth(nextVisibleMonth);
    setSelectedFrom(nextRange.from);
    setSelectedTo(nextRange.to);
    setCustomMonth(monthValue);
  }

  function moveVisibleMonth(direction: -1 | 1) {
    const nextMonth = addMonths(visibleMonth, direction);
    const nextRange = monthRange(nextMonth);
    setVisibleMonth(nextRange.visibleMonth);
    setSelectedFrom(nextRange.from);
    setSelectedTo(nextRange.to);
    setCustomMonth(format(nextRange.visibleMonth, "yyyy-MM"));
  }

  function toggleDate(dateKey: string) {
    if (californiaHolidays.has(dateKey) || dateKey < todayKey) {
      if (dateKey < todayKey) {
        setStatus("Past days cannot be selected or modified for time off.");
      }
      return;
    }
    setDraftEntries((currentEntries) => {
      const next = new Map(currentEntries);
      if (next.get(dateKey) === activeType) {
        next.delete(dateKey);
      } else {
        next.set(dateKey, activeType);
      }
      return next;
    });
  }

  useEffect(() => {
    void loadEntries();
  }, [selectedFrom, selectedTo]);

  useEffect(() => {
    setMode(detectMode(selectedFrom, selectedTo));
  }, [selectedFrom, selectedTo]);

  useEffect(() => {
    const syncParam = searchParams.get("calendar_sync");
    if (!syncParam) return;
    if (syncParam === "connected") {
      setStatus("Google Calendar connected. Future approved days off will sync automatically.");
    } else if (syncParam === "connection_failed") {
      setStatus("Google Calendar connection failed. Your app data is unchanged.");
    } else if (["oauth_state_invalid", "oauth_exchange_failed", "provider_error"].includes(syncParam)) {
      setStatus("Google Calendar connection could not be completed. Please try again.");
    }
  }, [searchParams]);

  function getDayState(day: Date): DayState {
    const dayKey = format(day, "yyyy-MM-dd");
    const entryType = draftEntries.get(dayKey);
    const systemHoliday = californiaHolidays.get(dayKey);
    const isPastDay = dayKey < todayKey;
    const isWeekend = [0, 6].includes(day.getDay());

    return {
      dayKey,
      entryType,
      saved: savedByDate.has(dayKey),
      holidayName: systemHoliday?.name,
      inVisibleMonth: isSameMonth(day, visibleMonth),
      isPastDay,
      isWeekend,
      isBlockedDay: isPastDay || Boolean(systemHoliday) || isWeekend,
      meta: entryType ? typeMeta(entryType) : null
    };
  }

  async function syncPublicHolidays() {
    setIsSyncingHolidays(true);
    setStatus("Syncing public holidays to Google Calendar...");
    try {
      const response = await fetch("/api/integrations/google-calendar/sync-public-holidays", {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Unable to sync public holidays.");
      }
      const payload = (await response.json()) as {
        results?: Array<{ status: "synced" | "failed"; date: string }>;
      };
      const syncedCount = payload.results?.filter((result) => result.status === "synced").length ?? 0;
      const failedCount = payload.results?.filter((result) => result.status === "failed").length ?? 0;
      setStatus(
        failedCount > 0
          ? `Public holidays synced with ${failedCount} failures.`
          : `${syncedCount} public holidays synced.`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to sync public holidays.");
    } finally {
      setIsSyncingHolidays(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <Card className="border-primary/20 bg-card/95 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-xl sm:text-2xl">Time off</CardTitle>
              <CardDescription>Plan full-day absences by type, keep the selected month obvious, and save approved dates instantly.</CardDescription>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-muted/90 to-transparent sm:hidden" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-muted/90 to-transparent sm:hidden" />
              <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Month range presets">
                <div className="inline-flex min-w-max snap-x snap-mandatory items-center gap-2">
                  {(["previous", "current", "next"] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={mode === preset}
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        "inline-flex h-9 shrink-0 snap-start items-center rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        mode === preset
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      {modeLabel(preset)}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={mode === "custom"}
                    onClick={() => setMode("custom")}
                    className={cn(
                      "inline-flex h-9 shrink-0 snap-start items-center rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      mode === "custom"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    Custom date
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
              <p className="leading-tight">
                <span className="font-semibold text-foreground">Selected:</span>{" "}
                <span className="font-medium text-foreground">{selectedLabel}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedFrom} to {selectedTo}
              </p>
              <p className="mt-1 text-xs font-medium text-foreground">Calendar month in view: {monthLabel}</p>
            </div>

            {mode === "custom" ? (
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-foreground">Month</span>
                <DatePickerInput
                  pickerType="month"
                  value={customMonth}
                  className="min-w-0"
                  onChange={(event) => {
                    const monthValue = event.target.value;
                    setCustomMonth(monthValue);
                    applyCustomMonth(monthValue);
                  }}
                />
              </label>
            ) : null}
          </div>

          <GoogleCalendarSyncCard onStatusChange={setCalendarSyncStatus} hideWhenConnected />

          <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Day type</p>
                <p className="text-xs text-muted-foreground">Pick the type first. Clicking a day assigns that type. Clicking it again removes it. California public holidays are read-only.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setActiveType(option.value)}
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    activeType === option.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground">{option.label}</span>
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", option.chipClass)}>Type</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{option.hint}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Days taken in selected range</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{selectedRangeDaysTaken}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Approved personal days off between {selectedFrom} and {selectedTo}.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Dates currently selected</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{selectedRangePendingChanges}</p>
              <p className="mt-1 text-xs text-muted-foreground">This includes unsaved edits currently shown in the calendar.</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4 sm:col-span-2 xl:col-span-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Calendar month</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{monthLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">{selectedLabel} • month view aligned with your selected range.</p>
            </div>
          </div>

          <div className="rounded-md bg-accent/40 px-3 py-2 text-sm text-accent-foreground">{status}</div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
              <p className="text-xs text-muted-foreground">This calendar is showing the current visible month. Saved dates can still exist outside this month if your selected range spans wider.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => moveVisibleMonth(-1)} className="h-9 px-3">
                Prev
              </Button>
              <Button variant="ghost" onClick={() => moveVisibleMonth(1)} className="h-9 px-3">
                Next
              </Button>
            </div>
          </div>

          <div className="hidden grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>

          <div className="space-y-2 sm:hidden">
            {visibleMonthDays.map((day) => {
              const state = getDayState(day);

              return (
                <button
                  key={`mobile-${state.dayKey}`}
                  type="button"
                  onClick={() => toggleDate(state.dayKey)}
                  disabled={state.isBlockedDay}
                  className={cn(
                    "w-full rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "bg-background",
                    state.entryType && state.meta?.calendarClass,
                    state.entryType && state.meta?.calendarTextClass,
                    state.holidayName && "border-success/40 bg-success/10",
                    state.isPastDay && "cursor-not-allowed border-border/60 bg-muted/50 text-muted-foreground opacity-70",
                    state.isWeekend && !state.holidayName && "cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground opacity-80"
                  )}
                  aria-pressed={Boolean(state.entryType)}
                  aria-label={`${state.dayKey}${state.entryType ? `, ${state.meta?.label}` : ""}${state.holidayName ? `, California public holiday ${state.holidayName}` : ""}${state.saved ? ", saved" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{format(day, "EEEE, MMM d")}</p>
                      <p className="text-xs text-muted-foreground">{state.dayKey}</p>
                    </div>
                    {state.holidayName ? (
                      <span className="rounded-full bg-success px-2.5 py-1 text-[11px] font-semibold text-success-foreground">Public holiday</span>
                    ) : state.saved ? (
                      <span className="rounded-full bg-success px-2.5 py-1 text-[11px] font-semibold text-success-foreground">Saved</span>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-1">
                    {state.holidayName ? (
                      <>
                        <p className="text-sm font-semibold text-foreground">{state.holidayName}</p>
                        <p className="text-xs text-muted-foreground">California public holiday</p>
                      </>
                    ) : state.entryType ? (
                      <>
                        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", state.meta?.chipClass)}>{state.meta?.label}</span>
                        <p className="text-xs text-muted-foreground">{state.meta?.hint}</p>
                      </>
                    ) : state.isWeekend ? (
                      <>
                        <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">Weekend</span>
                        <p className="text-xs text-muted-foreground">Not selectable</p>
                      </>
                    ) : state.isPastDay ? (
                      <p className="text-xs text-muted-foreground">Past day</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Tap to assign {typeMeta(activeType).label.toLowerCase()}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="hidden grid-cols-7 gap-2 sm:grid">
            {calendarDays.map((day) => {
              const state = getDayState(day);

              return (
                <button
                  key={state.dayKey}
                  type="button"
                  onClick={() => toggleDate(state.dayKey)}
                  disabled={state.isBlockedDay}
                  className={cn(
                    "min-h-[104px] rounded-2xl border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    state.inVisibleMonth ? "border-border bg-background" : "border-border/60 bg-muted/30 text-muted-foreground",
                    state.entryType && state.meta?.calendarClass,
                    state.entryType && state.meta?.calendarTextClass,
                    state.entryType && "shadow-sm",
                    state.holidayName && "border-success/40 bg-success/10",
                    isToday(day) && !state.entryType && "ring-1 ring-primary/40",
                    state.isPastDay && "cursor-not-allowed border-border/60 bg-muted/50 text-muted-foreground opacity-70",
                    state.isWeekend && !state.holidayName && "cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground opacity-80",
                    state.isBlockedDay && "pointer-events-none"
                  )}
                  aria-pressed={Boolean(state.entryType)}
                  aria-label={`${state.dayKey}${state.entryType ? `, ${state.meta?.label}` : ""}${state.holidayName ? `, California public holiday ${state.holidayName}` : ""}${state.saved ? ", saved" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{format(day, "d")}</span>
                    {state.holidayName ? (
                      <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-success-foreground">
                        Public holiday
                      </span>
                    ) : state.saved ? (
                      <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-success-foreground">
                        Saved
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-1">
                    {state.holidayName ? (
                      <>
                        <p className="text-[11px] font-semibold leading-4 text-foreground">{state.holidayName}</p>
                        <p className="text-[10px] leading-4 text-muted-foreground">California public holiday</p>
                      </>
                    ) : state.entryType ? (
                      <>
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", state.meta?.chipClass)}>
                          {state.meta?.label}
                        </span>
                        <p className={cn("text-[11px] leading-4", state.entryType ? "text-foreground/80" : "text-muted-foreground")}>{state.meta?.hint}</p>
                      </>
                    ) : state.isWeekend ? (
                      <>
                        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
                          Weekend
                        </span>
                        <p className="text-[11px] leading-4 text-muted-foreground">Not selectable</p>
                      </>
                    ) : state.isPastDay ? (
                      <p className="text-[11px] leading-4 text-muted-foreground">Past day</p>
                    ) : (
                      <p className="text-[11px] leading-4 text-muted-foreground">Available</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void saveSelection()} disabled={!hasChanges || isSaving} className="w-full sm:w-auto">
              {isSaving ? "Saving..." : "Save time off"}
            </Button>
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming time off</CardTitle>
          <CardDescription>Approved absences and California public holidays coming next across the selected range.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading upcoming time off...</p> : null}
          {!isLoading && upcomingEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming time off saved yet.</p>
          ) : null}
          {upcomingEntries.map((entry) => {
            const meta = typeMeta(entry.type === "pto" ? "unpaid_leave" : entry.type);
            return (
              <div key={entry.id} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{formatDateOnly(entry.date, "EEEE, MMM d")}</p>
                  <p className="text-xs text-muted-foreground">{meta.label} • approved immediately</p>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", meta.chipClass)}>{meta.label}</span>
              </div>
            );
          })}
          {[...californiaHolidays.values()]
            .filter((holiday) => holiday.date >= format(new Date(), "yyyy-MM-dd"))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 6)
            .map((holiday) => (
              <div key={`holiday-${holiday.date}`} className="flex items-center justify-between rounded-xl border border-success/30 bg-success/5 px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{formatDateOnly(holiday.date, "EEEE, MMM d")}</p>
                  <p className="text-xs text-muted-foreground">{holiday.name} • California public holiday</p>
                </div>
                <span className="rounded-full bg-success px-3 py-1 text-xs font-semibold text-success-foreground">Holiday</span>
              </div>
            ))}
          {calendarSyncStatus === "connected" ? (
            <div className="pt-2">
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => void syncPublicHolidays()}
                disabled={isSyncingHolidays}
              >
                {isSyncingHolidays ? "Syncing..." : "Sync public holidays"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
