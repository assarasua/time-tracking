"use client";

import { useEffect, useMemo, useState } from "react";

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

  return (
    <div className="card stack">
      <div className="row">
        <h3 style={{ margin: 0 }}>This week</h3>
        <span>{status}</span>
      </div>

      <div className="grid-two">
        <div>
          <small>Worked</small>
          <div>{formatMinutes(summary?.workedMinutes ?? 0)}</div>
        </div>
        <div>
          <small>Expected</small>
          <div>{formatMinutes(summary?.expectedMinutes ?? 0)}</div>
        </div>
      </div>

      <div>
        <small>Variance</small>
        <div>{formatMinutes(summary?.varianceMinutes ?? 0)}</div>
      </div>

      {activeSession ? (
        <button onClick={clockOut}>Clock out</button>
      ) : (
        <button onClick={clockIn}>Clock in</button>
      )}

      <div className="stack">
        <strong>Recent sessions</strong>
        {(summary?.sessions ?? []).slice(-5).reverse().map((session) => (
          <div key={session.id} className="row" style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            <span>{new Date(session.startAt).toLocaleString()}</span>
            <span>{session.endAt ? new Date(session.endAt).toLocaleTimeString() : "Active"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
