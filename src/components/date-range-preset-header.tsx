"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  detectSelectionMode,
  getCurrentWeekRange,
  getModeLabel,
  getNextWeekRange,
  getPreviousWeekRange,
  normalizeRange,
  type SelectionMode
} from "@/lib/date-range";
import { cn } from "@/lib/cn";

type DateRangePresetHeaderProps = {
  showNextPreset?: boolean;
  initialFrom: string;
  initialTo: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  syncQuery?: boolean;
  onApply?: (range: { from: string; to: string; mode: SelectionMode }) => void;
  className?: string;
};

const PRESETS: Array<{ mode: Exclude<SelectionMode, "custom">; label: string }> = [
  { mode: "current", label: "Current week" },
  { mode: "previous", label: "Previous week" },
  { mode: "next", label: "Next week" }
];

export function DateRangePresetHeader({
  showNextPreset = true,
  initialFrom,
  initialTo,
  weekStartsOn = 1,
  syncQuery = true,
  onApply,
  className
}: DateRangePresetHeaderProps) {
  const presets = showNextPreset ? PRESETS : PRESETS.filter((preset) => preset.mode !== "next");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = useMemo(() => normalizeRange(initialFrom, initialTo), [initialFrom, initialTo]);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [mode, setMode] = useState<SelectionMode>(detectSelectionMode(initial.from, initial.to, weekStartsOn));
  const [announcement, setAnnouncement] = useState("");

  function sync(fromValue: string, toValue: string, modeValue: SelectionMode) {
    if (syncQuery) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("from", fromValue);
      next.set("to", toValue);
      router.replace(`${pathname}?${next.toString()}` as any, { scroll: false });
    }

    onApply?.({ from: fromValue, to: toValue, mode: modeValue });
    setAnnouncement(`Selected ${getModeLabel(modeValue)} from ${fromValue} to ${toValue}.`);
  }

  function applyPreset(nextMode: Exclude<SelectionMode, "custom">) {
    const range =
      nextMode === "current"
        ? getCurrentWeekRange(weekStartsOn)
        : nextMode === "previous"
          ? getPreviousWeekRange(weekStartsOn)
          : getNextWeekRange(weekStartsOn);

    setMode(nextMode);
    setFrom(range.from);
    setTo(range.to);
    sync(range.from, range.to, nextMode);
  }

  function applyCustom() {
    const normalized = normalizeRange(from, to);
    setFrom(normalized.from);
    setTo(normalized.to);
    setMode("custom");
    sync(normalized.from, normalized.to, "custom");
  }

  function handleManualDateChange(kind: "from" | "to", value: string) {
    setMode("custom");
    if (kind === "from") {
      setFrom(value);
      return;
    }

    setTo(value);
  }

  return (
    <div className={cn("space-y-3 rounded-xl border border-border bg-muted/40 p-3 sm:p-4", className)}>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-muted/90 to-transparent sm:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-muted/90 to-transparent sm:hidden" />
        <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" role="group" aria-label="Date range presets">
          <div className="inline-flex min-w-max snap-x snap-mandatory items-center gap-2">
            {presets.map((preset) => (
              <button
                key={preset.mode}
                type="button"
                className={`inline-flex h-9 shrink-0 snap-start items-center rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  mode === preset.mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                aria-pressed={mode === preset.mode}
                onClick={() => applyPreset(preset.mode)}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              className={`inline-flex h-9 shrink-0 snap-start items-center rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                mode === "custom"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              aria-pressed={mode === "custom"}
              onClick={() => setMode("custom")}
            >
              Custom date
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
        <p className="leading-tight">
          <span className="font-semibold text-foreground">Selected:</span>{" "}
          <span className="font-medium text-foreground">{getModeLabel(mode)}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ({from} to {to})
        </p>
      </div>

      {mode === "custom" ? (
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            applyCustom();
          }}
        >
          <label className="min-w-0 space-y-1 text-sm">
            <span className="font-medium text-foreground">From</span>
            <Input
              type="date"
              value={from}
              className="min-w-0"
              onChange={(event) => handleManualDateChange("from", event.target.value)}
            />
          </label>
          <label className="min-w-0 space-y-1 text-sm">
            <span className="font-medium text-foreground">To</span>
            <Input
              type="date"
              value={to}
              className="min-w-0"
              onChange={(event) => handleManualDateChange("to", event.target.value)}
            />
          </label>
          <div className="flex items-end sm:col-span-2 sm:justify-end">
            <Button type="submit" className="w-full sm:w-auto">
              Apply
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
