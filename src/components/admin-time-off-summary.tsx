"use client";

import { addYears, format, startOfYear, subYears } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";

import { AdminModalShell } from "@/components/admin-modal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatDateOnly } from "@/lib/date-only";

type MemberRow = {
  membershipId: string;
  name: string;
  email: string;
};

type TimeOffEntry = {
  id: string;
  organizationUserId: string;
  date: string;
  type: string;
};

type RangeMode = "previousYear" | "currentYear" | "nextYear" | "customMonth";

function timeOffTypeMeta(type: string) {
  if (type === "holiday") return { label: "Holiday", className: "bg-success text-success-foreground" };
  if (type === "pto" || type === "unpaid_leave") return { label: "Unpaid leave", className: "bg-accent text-accent-foreground" };
  if (type === "not_working") return { label: "Not working", className: "bg-muted text-foreground" };
  return { label: "Vacation", className: "bg-primary text-primary-foreground" };
}

function yearRange(base: Date) {
  const yearStart = startOfYear(base);
  return {
    from: format(yearStart, "yyyy-MM-dd"),
    to: format(addYears(yearStart, 1), "yyyy-MM-dd").replace(/-01-01$/, "-12-31"),
    label: format(yearStart, "yyyy")
  };
}

function currentYearRange() {
  return yearRange(new Date());
}

function previousYearRange() {
  return yearRange(subYears(new Date(), 1));
}

function nextYearRange() {
  return yearRange(addYears(new Date(), 1));
}

function endOfMonthString(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  return format(new Date(Date.UTC(year, month, 0, 0, 0, 0, 0)), "yyyy-MM-dd");
}

function modeLabel(mode: RangeMode) {
  if (mode === "previousYear") return "Previous year";
  if (mode === "nextYear") return "Next year";
  if (mode === "currentYear") return "Current year";
  return "Custom month";
}

export function AdminTimeOffSummary({ members }: { members: MemberRow[] }) {
  const currentYear = currentYearRange();
  const [mode, setMode] = useState<RangeMode>("currentYear");
  const [selectedFrom, setSelectedFrom] = useState(currentYear.from);
  const [selectedTo, setSelectedTo] = useState(currentYear.to);
  const [customMonth, setCustomMonth] = useState(format(new Date(), "yyyy-MM"));
  const [entries, setEntries] = useState<TimeOffEntry[]>([]);
  const [status, setStatus] = useState("Loading yearly time off...");
  const [selectedRow, setSelectedRow] = useState<(MemberRow & { entries: TimeOffEntry[]; totalDays: number }) | null>(null);
  const [modalAnchorTop, setModalAnchorTop] = useState(24);

  const rows = useMemo(
    () =>
      members.map((member) => {
        const memberEntries = entries
          .filter((entry) => entry.organizationUserId === member.membershipId)
          .sort((a, b) => a.date.localeCompare(b.date));

        return {
          ...member,
          entries: memberEntries,
          totalDays: memberEntries.length
        };
      }),
    [entries, members]
  );

  const totals = useMemo(
    () => ({
      daysRequested: rows.reduce((total, row) => total + row.totalDays, 0),
      employeesRequesting: rows.filter((row) => row.totalDays > 0).length
    }),
    [rows]
  );

  async function loadEntries(from = selectedFrom, to = selectedTo) {
    setStatus("Loading time off...");

    try {
      const response = await fetch(`/api/admin/time-off?from=${from}&to=${to}`, {
        cache: "no-store",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Unable to load admin time off.");
      }

      const payload = (await response.json()) as { entries: TimeOffEntry[] };
      setEntries(payload.entries);
      setStatus(`Showing ${modeLabel(mode).toLowerCase()} time off from ${from} to ${to}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load admin time off.");
    }
  }

  function applyPreset(nextMode: Exclude<RangeMode, "customMonth">) {
    const range =
      nextMode === "previousYear" ? previousYearRange() : nextMode === "nextYear" ? nextYearRange() : currentYearRange();
    setMode(nextMode);
    setSelectedFrom(range.from);
    setSelectedTo(range.to);
  }

  function applyCustomMonth(monthValue: string) {
    if (!monthValue) return;
    setMode("customMonth");
    setCustomMonth(monthValue);
    setSelectedFrom(`${monthValue}-01`);
    setSelectedTo(endOfMonthString(monthValue));
  }

  useEffect(() => {
    void loadEntries();
  }, [selectedFrom, selectedTo]);

  return (
    <div className="space-y-5">
      {selectedRow ? (
        <AdminModalShell
          title={selectedRow.name}
          subtitle={`${selectedRow.email} · ${selectedRow.totalDays} requested day${selectedRow.totalDays === 1 ? "" : "s"} between ${selectedFrom} and ${selectedTo}`}
          onClose={() => setSelectedRow(null)}
          sizeClassName="max-w-2xl"
          zIndexClassName="z-[60]"
          anchorTop={modalAnchorTop}
        >
          <div className="space-y-2">
            {selectedRow.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requested days inside the selected filter.</p>
            ) : null}
            {selectedRow.entries.map((entry) => {
              const meta = timeOffTypeMeta(entry.type);
              return (
                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-3">
                  <span className="text-sm font-medium text-foreground">{formatDateOnly(entry.date, "EEE, MMM d, yyyy")}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                </div>
              );
            })}
          </div>
        </AdminModalShell>
      ) : null}

      <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-muted/90 to-transparent sm:hidden" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-muted/90 to-transparent sm:hidden" />
          <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Admin time off presets">
            <div className="inline-flex min-w-max snap-x snap-mandatory items-center gap-2">
              {(["previousYear", "currentYear", "nextYear"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  aria-pressed={mode === preset}
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
                onClick={() => setMode("customMonth")}
                aria-pressed={mode === "customMonth"}
                className={cn(
                  "inline-flex h-9 shrink-0 snap-start items-center rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  mode === "customMonth"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                Custom month
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
          <p className="leading-tight">
            <span className="font-semibold text-foreground">Selected:</span>{" "}
            <span className="font-medium text-foreground">{modeLabel(mode)}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedFrom} to {selectedTo}
          </p>
        </div>

        {mode === "customMonth" ? (
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Month</span>
            <Input
              type="month"
              value={customMonth}
              className="min-w-0"
              onChange={(event) => applyCustomMonth(event.target.value)}
            />
          </label>
        ) : null}
      </div>

      <div className="rounded-md bg-accent/40 px-3 py-2 text-sm text-accent-foreground">{status}</div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Days requested</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{totals.daysRequested}</p>
          <p className="mt-1 text-xs text-muted-foreground">Requested day records inside the selected admin filter.</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Employees requesting</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{totals.employeesRequesting}</p>
          <p className="mt-1 text-xs text-muted-foreground">Employees with one or more requested days in filter.</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Employees tracked</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{rows.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">One row per employee, including zero-day cases.</p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.membershipId}
            className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.email}</p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                {row.totalDays} day{row.totalDays === 1 ? "" : "s"}
              </span>
              <Button
                variant="ghost"
                className="h-9 border border-border bg-background px-3 text-xs font-semibold"
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  const viewportHeight = window.innerHeight;
                  const nextTop = Math.min(Math.max(16, event.currentTarget.getBoundingClientRect().top - 24), Math.max(16, viewportHeight - 280));
                  setModalAnchorTop(nextTop);
                  setSelectedRow(row);
                }}
              >
                Open details
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
