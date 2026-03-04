"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Route } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Session = {
  id: string;
  startAt: string;
  endAt: string | null;
};

type Summary = {
  workedMinutes: number;
  expectedMinutes: number;
  varianceMinutes: number;
  sessions: Session[];
};

type MonthSummary = {
  workedMinutes: number;
};

function formatMinutes(minutes: number) {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${hours}h ${mins}m`;
}

export function ClockCard({ weekStart, month }: { weekStart: string; month: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null);
  const [status, setStatus] = useState<string>("Loading...");
  const timesheetRoute = "/timesheet" as Route;

  async function loadSummary() {
    setStatus("Loading...");
    setSummary(null);
    setMonthSummary(null);

    try {
      const [weekResponse, monthResponse] = await Promise.all([
        fetch(`/api/me/week-summary?week_start=${weekStart}`),
        fetch(`/api/me/month-summary?month=${month}`)
      ]);

      if (weekResponse.ok) {
        const weekData = (await weekResponse.json()) as Summary;
        setSummary(weekData);
      }

      if (monthResponse.ok) {
        const monthData = (await monthResponse.json()) as MonthSummary;
        setMonthSummary(monthData);
      }

      if (weekResponse.ok && monthResponse.ok) {
        setStatus("Ready");
        return;
      }

      if (weekResponse.status === 401 || monthResponse.status === 401) {
        setStatus("Session expired. Please sign in again.");
        return;
      }

      setStatus("Partially loaded");
    } catch {
      setStatus("Unable to load summary");
    }
  }

  useEffect(() => {
    void loadSummary();
  }, [weekStart, month]);

  const statTiles = [
    { label: "Worked", value: formatMinutes(summary?.workedMinutes ?? 0) },
    { label: "Expected", value: formatMinutes(summary?.expectedMinutes ?? 0) },
    { label: "Variance", value: formatMinutes(summary?.varianceMinutes ?? 0) },
    { label: "Month Worked", value: formatMinutes(monthSummary?.workedMinutes ?? 0) }
  ];

  return (
    <Card className="border-primary/20 bg-card/95 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Weekly overview</CardTitle>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">{status}</span>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statTiles.map((tile) => (
            <div key={tile.label} className="rounded-md border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{tile.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          Manual hour entry is available from the timesheet view.
          <Link href={timesheetRoute} className="ml-2 font-semibold text-primary hover:underline">
            Open timesheet
          </Link>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Recent entries</h4>
          {(summary?.sessions ?? []).slice(-5).reverse().map((session) => (
            <div
              key={session.id}
              className="flex flex-col justify-between gap-1 rounded-md border border-border bg-background p-3 text-sm sm:flex-row sm:items-center"
            >
              <span className="text-foreground">{new Date(session.startAt).toLocaleString()}</span>
              <span className="text-muted-foreground">
                {session.endAt ? new Date(session.endAt).toLocaleTimeString() : "Active"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
