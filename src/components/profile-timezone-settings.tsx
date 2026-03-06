"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type ProfileResponse = {
  timezone: string;
  preferredTimezone: string | null;
  organizationTimezone: string;
};

const TIMEZONE_OPTIONS = [
  { value: "Europe/Madrid", label: "Madrid (CET/CEST)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "Asia/Manila", label: "Manila (PHT)" }
];

export function ProfileTimezoneSettings({
  closeOnSelect = false,
  onSaved
}: {
  closeOnSelect?: boolean;
  onSaved?: (timezone: string) => void;
}) {
  const [value, setValue] = useState("Europe/Madrid");
  const [organizationTimezone, setOrganizationTimezone] = useState("Europe/Madrid");
  const [status, setStatus] = useState<"loading" | "saving" | "saved" | "error" | "idle">("loading");
  const [message, setMessage] = useState("Loading profile...");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch("/api/me/profile", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load profile.");
        const payload = (await response.json()) as ProfileResponse;
        if (!mounted) return;
        const isAllowed = TIMEZONE_OPTIONS.some((option) => option.value === payload.timezone);
        setValue(isAllowed ? payload.timezone : "Europe/Madrid");
        setOrganizationTimezone(payload.organizationTimezone);
        setStatus("idle");
        setMessage("Ready");
      } catch (error) {
        if (!mounted) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Unable to load profile.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const isBusy = status === "loading" || status === "saving";
  const helperLabel = useMemo(
    () =>
      value === organizationTimezone
        ? `Using organization default (${organizationTimezone})`
        : `Using personal timezone (${value})`,
    [organizationTimezone, value]
  );

  async function saveTimezone(nextTimezone?: string) {
    const timezoneToSave = nextTimezone ?? value;
    setStatus("saving");
    setMessage("Saving timezone...");
    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: timezoneToSave })
      });
      if (!response.ok) {
        throw new Error("Unable to save timezone.");
      }
      setStatus("saved");
      setMessage("Timezone saved.");
      onSaved?.(timezoneToSave);
      setTimeout(() => {
        setStatus("idle");
      }, 1200);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to save timezone.");
    }
  }

  return (
    <div className="rounded-md border border-border bg-background p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1 text-sm">
          <span className="font-medium text-foreground">Profile timezone</span>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value;
              setValue(nextValue);
              if (closeOnSelect) {
                void saveTimezone(nextValue);
              }
            }}
            disabled={isBusy}
          >
            {TIMEZONE_OPTIONS.map((timezone) => (
              <option key={timezone.value} value={timezone.value}>
                {timezone.label}
              </option>
            ))}
          </select>
        </label>
        {!closeOnSelect ? (
          <Button onClick={() => void saveTimezone()} disabled={isBusy}>
            {status === "saving" ? "Saving..." : "Save timezone"}
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{helperLabel}</p>
      <p
        className={`mt-1 text-xs ${
          status === "error" ? "text-destructive" : status === "saved" ? "text-success-foreground" : "text-muted-foreground"
        }`}
        aria-live="polite"
      >
        {message}
      </p>
    </div>
  );
}
