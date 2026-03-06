"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export type CalendarSyncStatus = "not_connected" | "connected" | "reconnect_required" | "sync_issue";

type StatusResponse = {
  status: CalendarSyncStatus;
  lastError: string | null;
};

const COPY = {
  not_connected: {
    title: "Google Calendar not connected",
    body: "Your approved days off can be added to your personal Google Calendar automatically.",
    cta: "Connect"
  },
  connected: {
    title: "Google Calendar connected",
    body: "Future approved days off sync to your personal Google Calendar as private all-day events.",
    cta: "Disconnect"
  },
  reconnect_required: {
    title: "Reconnect required",
    body: "Google Calendar access expired or was revoked. Reconnect to resume automatic sync.",
    cta: "Reconnect"
  },
  sync_issue: {
    title: "Sync issue detected",
    body: "Days off are still saved in the app, but at least one Google Calendar sync failed.",
    cta: "Reconnect"
  }
} as const;

export function GoogleCalendarSyncCard({
  onStatusChange,
  hideWhenConnected = false
}: {
  onStatusChange?: (status: CalendarSyncStatus) => void;
  hideWhenConnected?: boolean;
}) {
  const [status, setStatus] = useState<CalendarSyncStatus>("not_connected");
  const [lastError, setLastError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [message, setMessage] = useState("Loading Google Calendar sync...");
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  async function loadStatus() {
    setIsBusy(true);
    try {
      const response = await fetch("/api/integrations/google-calendar/status", { cache: "no-store", credentials: "include" });
      if (!response.ok) throw new Error("Unable to load Google Calendar status.");
      const payload = (await response.json()) as StatusResponse;
      setStatus(payload.status);
      setLastError(payload.lastError);
      onStatusChange?.(payload.status);
      setMessage("Ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load Google Calendar status.");
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function disconnect() {
    setIsBusy(true);
    setMessage("Disconnecting Google Calendar...");
    try {
      const response = await fetch("/api/integrations/google-calendar/disconnect", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Unable to disconnect Google Calendar.");
      await loadStatus();
      setMessage("Google Calendar disconnected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to disconnect Google Calendar.");
      setIsBusy(false);
    }
  }

  const copy = COPY[status];

  if (hideWhenConnected && status === "connected") {
    return null;
  }

  return (
    <>
      {showDisconnectConfirm ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-foreground/35 p-4 pt-24" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg">
            <p className="text-base font-semibold text-foreground">Disconnect Google Calendar?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Disconnecting will remove all calendar events previously synced by this app from your Google Calendar.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Your days off will remain saved in the app. Only the Google Calendar events will be removed.
            </p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowDisconnectConfirm(false)} disabled={isBusy}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setShowDisconnectConfirm(false);
                  void disconnect();
                }}
                disabled={isBusy}
              >
                Confirm disconnect
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{copy.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
            {lastError ? <p className="mt-2 text-xs text-destructive">{lastError}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{message}</p>
          </div>
          {status === "connected" ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => setShowDisconnectConfirm(true)}
              disabled={isBusy}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => {
                window.location.href = "/api/integrations/google-calendar/start";
              }}
              disabled={isBusy}
            >
              {copy.cta}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
