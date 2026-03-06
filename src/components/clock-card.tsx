"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RangeSummary = {
  from: string;
  to: string;
  workedMinutes: number;
  expectedMinutes: number;
  varianceMinutes: number;
  daily: Array<{ date: string; workedMinutes: number }>;
  monthly: Array<{ month: string; workedMinutes: number }>;
};

function formatMinutes(minutes: number) {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${hours}h ${mins}m`;
}

export function ClockCard({ from, to }: { from: string; to: string }) {
  const [summary, setSummary] = useState<RangeSummary | null>(null);
  const [monthlyRows, setMonthlyRows] = useState<Array<{ month: string; workedMinutes: number }>>([]);
  const [status, setStatus] = useState<string>("Loading...");
  const lastLoadedKeyRef = useRef<string>("");
  const timesheetRoute = "/timesheet" as Route;

  async function loadSummary() {
    const rangeKey = `${from}:${to}`;
    if (lastLoadedKeyRef.current === rangeKey) return;
    lastLoadedKeyRef.current = rangeKey;

    setStatus("Loading...");
    setSummary(null);
    setMonthlyRows([]);

    try {
      const response = await fetch(`/api/me/range-summary?from=${from}&to=${to}`);
      if (response.status === 401) {
        setStatus("Session expired. Please sign in again.");
        return;
      }
      if (!response.ok) {
        setStatus("Unable to load summary");
        return;
      }

      const data = (await response.json()) as RangeSummary;
      setSummary(data);
      setMonthlyRows(data.monthly ?? []);
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
    { label: "Variance", value: formatMinutes(summary?.varianceMinutes ?? 0) }
  ];
  const maxDailyMinutes = Math.max(1, ...(summary?.daily ?? []).map((day) => day.workedMinutes));

  return (
    <Card className="border-primary/20 bg-card/95 shadow-sm">
      <CardHeader className="flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg sm:text-xl">Overview</CardTitle>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">{status}</span>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {statTiles.map((tile) => (
            <div key={tile.label} className="rounded-md border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{tile.value}</p>
            </div>
          ))}
        </div>

        <div className="hidden space-y-2 sm:block">
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
          <h4 className="text-sm font-semibold text-foreground">Monthly hours</h4>
          <div className="grid gap-2 sm:hidden">
            {monthlyRows.map((row) => (
              <div key={row.month} className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {format(new Date(`${row.month}-01T00:00:00.000Z`), "MMMM yyyy")}
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">{formatMinutes(row.workedMinutes)}</p>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-md border border-border bg-background sm:block">
            <div className="min-w-[320px]">
              <div className="grid grid-cols-2 border-b border-border px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span>Month</span>
                <span className="text-right">Total worked</span>
              </div>
              {monthlyRows.map((row) => (
                <div key={row.month} className="grid grid-cols-2 px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">
                    {format(new Date(`${row.month}-01T00:00:00.000Z`), "MMMM yyyy")}
                  </span>
                  <span className="text-right font-semibold text-foreground">{formatMinutes(row.workedMinutes)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
