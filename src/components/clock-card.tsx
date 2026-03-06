"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCaliforniaPublicHolidaysByDate } from "@/lib/california-holidays";
import { formatDateOnly } from "@/lib/date-only";

type RangeSummary = {
  from: string;
  to: string;
  workedMinutes: number;
  expectedMinutes: number;
  varianceMinutes: number;
  annualTimeOffDays: number;
  daily: Array<{ date: string; workedMinutes: number }>;
};

type TimeOffEntry = {
  id: string;
  date: string;
  type: "vacation" | "unpaid_leave" | "not_working" | "pto";
};

function timeOffLabel(type: TimeOffEntry["type"]) {
  if (type === "pto" || type === "unpaid_leave") return "Unpaid leave";
  if (type === "not_working") return "Not working";
  return "Vacation";
}

function formatMinutes(minutes: number) {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${hours}h ${mins}m`;
}

export function ClockCard({ from, to }: { from: string; to: string }) {
  const [summary, setSummary] = useState<RangeSummary | null>(null);
  const [plannedDaysOff, setPlannedDaysOff] = useState<TimeOffEntry[]>([]);
  const [status, setStatus] = useState<string>("Loading...");
  const lastLoadedKeyRef = useRef<string>("");
  const timesheetRoute = "/timesheet" as Route;
  const timeOffRoute = "/time-off" as Route;
  const publicHolidays = [...getCaliforniaPublicHolidaysByDate(from, to).values()];

  async function loadSummary() {
    const rangeKey = `${from}:${to}`;
    if (lastLoadedKeyRef.current === rangeKey) return;
    lastLoadedKeyRef.current = rangeKey;

    setStatus("Loading...");
    setSummary(null);
    setPlannedDaysOff([]);

    try {
      const [summaryResponse, timeOffResponse] = await Promise.all([
        fetch(`/api/me/range-summary?from=${from}&to=${to}`),
        fetch(`/api/time-off?from=${from}&to=${to}`, { cache: "no-store" })
      ]);

      if (summaryResponse.status === 401 || timeOffResponse.status === 401) {
        setStatus("Session expired. Please sign in again.");
        return;
      }

      if (!summaryResponse.ok) {
        setStatus("Unable to load summary");
        return;
      }

      const data = (await summaryResponse.json()) as RangeSummary;
      setSummary(data);

      if (timeOffResponse.ok) {
        const timeOffData = (await timeOffResponse.json()) as { entries?: TimeOffEntry[] };
        setPlannedDaysOff((timeOffData.entries ?? []).sort((a, b) => a.date.localeCompare(b.date)));
      }

      setStatus("Ready");
    } catch {
      setStatus("Unable to load summary");
    }
  }

  useEffect(() => {
    void loadSummary();
  }, [from, to]);

  const statTiles = [
    { label: "Worked", value: formatMinutes(summary?.workedMinutes ?? 0) },
    { label: "Expected", value: formatMinutes(summary?.expectedMinutes ?? 0) },
    { label: "Variance", value: formatMinutes(summary?.varianceMinutes ?? 0) },
    { label: "Days off this year", value: String(summary?.annualTimeOffDays ?? 0) }
  ];
  const maxDailyMinutes = Math.max(1, ...(summary?.daily ?? []).map((day) => day.workedMinutes));

  return (
    <Card className="border-primary/20 bg-card/95 shadow-sm">
      <CardHeader className="flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg sm:text-xl">Overview</CardTitle>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">{status}</span>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {statTiles.map((tile) => (
            <div key={tile.label} className="rounded-md border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{tile.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Daily hours in selected range</h4>
          <div className="overflow-x-auto rounded-md border border-border bg-background p-3">
            <div className="flex min-w-max items-end gap-2">
              {(summary?.daily ?? []).map((day) => {
                const barHeight = Math.max(6, Math.round((day.workedMinutes / maxDailyMinutes) * 120));
                return (
                  <div key={day.date} className="w-12 shrink-0 space-y-1 text-center">
                    <p className="text-[11px] font-medium text-foreground">{formatMinutes(day.workedMinutes)}</p>
                    <div className="flex h-32 items-end rounded-md bg-muted/60 px-1 pb-1">
                      <div
                        className="w-full rounded-sm bg-primary transition-all"
                        style={{ height: `${barHeight}px` }}
                        title={`${day.date}: ${formatMinutes(day.workedMinutes)}`}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(`${day.date}T00:00:00.000Z`), "MMM d")}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          Manual hour entry is available from the timesheet view.
          <Link href={timesheetRoute} className="ml-2 font-semibold text-primary hover:underline">
            Open timesheet
          </Link>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-foreground">Planned days off</h4>
            <Link href={timeOffRoute} className="text-xs font-semibold text-primary hover:underline">
              Manage time off
            </Link>
          </div>
          <div className="space-y-2 rounded-md border border-border bg-background p-3">
            {plannedDaysOff.length === 0 ? (
              <p className="text-sm text-muted-foreground">No planned days off saved for this week.</p>
            ) : (
              plannedDaysOff.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{formatDateOnly(entry.date, "EEEE, MMM d")}</p>
                    <p className="text-xs text-muted-foreground">{timeOffLabel(entry.type)}</p>
                  </div>
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                    {timeOffLabel(entry.type)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Public holidays</h4>
          <div className="space-y-2 rounded-md border border-border bg-background p-3">
            {publicHolidays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No public holidays fall within the current week.</p>
            ) : (
              publicHolidays.map((holiday) => (
                <div key={holiday.date} className="flex items-center justify-between gap-3 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{formatDateOnly(holiday.date, "EEEE, MMM d")}</p>
                    <p className="text-xs text-muted-foreground">{holiday.name}</p>
                  </div>
                  <span className="rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-success-foreground">
                    Public holiday
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
