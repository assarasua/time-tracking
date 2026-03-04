"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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

function formatMinutes(minutes: number) {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${hours}h ${mins}m`;
}

export function ClockCard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<string>("Loading...");

  async function loadSummary() {
    const response = await fetch("/api/me/week-summary");
    if (!response.ok) {
      setStatus("Unable to load summary");
      return;
    }

    const data = (await response.json()) as Summary;
    setSummary(data);
    setStatus("Ready");
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  const activeSession = useMemo(() => summary?.sessions.find((session) => !session.endAt), [summary]);

  async function clockIn() {
    setStatus("Clocking in...");
    const response = await fetch("/api/time-sessions/start", { method: "POST" });
    if (!response.ok) {
      setStatus("Clock in failed");
      return;
    }
    await loadSummary();
  }

  async function clockOut() {
    if (!activeSession) return;

    setStatus("Clocking out...");
    const response = await fetch(`/api/time-sessions/${activeSession.id}/stop`, { method: "POST" });
    if (!response.ok) {
      setStatus("Clock out failed");
      return;
    }
    await loadSummary();
  }

  const statTiles = [
    { label: "Worked", value: formatMinutes(summary?.workedMinutes ?? 0) },
    { label: "Expected", value: formatMinutes(summary?.expectedMinutes ?? 0) },
    { label: "Variance", value: formatMinutes(summary?.varianceMinutes ?? 0) }
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>This week</CardTitle>
        <span className="rounded-md bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{status}</span>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {statTiles.map((tile) => (
            <div key={tile.label} className="rounded-md border border-border bg-muted/70 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{tile.value}</p>
            </div>
          ))}
        </div>

        {activeSession ? (
          <Button onClick={clockOut} className="w-full sm:w-auto">
            Clock out
          </Button>
        ) : (
          <Button onClick={clockIn} className="w-full sm:w-auto">
            Clock in
          </Button>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Recent sessions</h4>
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
