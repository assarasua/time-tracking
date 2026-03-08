"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";

import { AdminModalShell } from "@/components/admin-modal-shell";
import { InvoicePreviewModal } from "@/components/invoice-preview-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatUsd } from "@/lib/currency";
import { formatFileSize } from "@/lib/file-size";
import { formatMonthKey, getMonthModeLabel, getPreviousMonthRange, type MonthSelectionMode } from "@/lib/month-range";

type MemberRow = {
  membershipId: string;
  name: string;
  email: string;
};

type AdminExpense = {
  id: string;
  organizationUserId: string;
  expenseMonth: string;
  expenseDate: string;
  reference: string;
  totalAmount: number;
  currency: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  paidAt: string | null;
  updatedAt: string;
};

type GroupedRow = MemberRow & {
  expenses: AdminExpense[];
  totalAmount: number;
  unpaidTotalAmount: number;
  paidCount: number;
};

const PRESETS: MonthSelectionMode[] = ["previous"];

export function AdminExpensesSummary({ members }: { members: MemberRow[] }) {
  const previous = getPreviousMonthRange();
  const [month, setMonth] = useState(previous.month);
  const [mode, setMode] = useState<MonthSelectionMode>("previous");
  const [expenses, setExpenses] = useState<AdminExpense[]>([]);
  const [status, setStatus] = useState("Loading expense coverage...");
  const [previewExpense, setPreviewExpense] = useState<(AdminExpense & { memberName: string }) | null>(null);
  const [openRow, setOpenRow] = useState<GroupedRow | null>(null);
  const [modalAnchorTop, setModalAnchorTop] = useState(24);
  const [previewAnchorTop, setPreviewAnchorTop] = useState(24);

  const rows = useMemo<GroupedRow[]>(() => {
    const byMembership = new Map<string, AdminExpense[]>();
    for (const expense of expenses) {
      const current = byMembership.get(expense.organizationUserId) ?? [];
      current.push(expense);
      byMembership.set(expense.organizationUserId, current);
    }

    return members.map((member) => {
      const memberExpenses = (byMembership.get(member.membershipId) ?? []).sort((left, right) =>
        `${right.expenseDate}-${right.updatedAt}`.localeCompare(`${left.expenseDate}-${left.updatedAt}`)
      );
      return {
        ...member,
        expenses: memberExpenses,
        totalAmount: memberExpenses.reduce((sum, expense) => sum + expense.totalAmount, 0),
        unpaidTotalAmount: memberExpenses.filter((expense) => !expense.paidAt).reduce((sum, expense) => sum + expense.totalAmount, 0),
        paidCount: memberExpenses.filter((expense) => Boolean(expense.paidAt)).length
      };
    });
  }, [expenses, members]);

  const summary = useMemo(
    () => ({
      expected: rows.length,
      uploaded: rows.filter((row) => row.expenses.length > 0).length,
      totalAmount: rows.reduce((sum, row) => sum + row.totalAmount, 0)
    }),
    [rows]
  );

  async function loadExpenses(targetMonth = month) {
    setStatus("Loading expense coverage...");
    try {
      const response = await fetch(`/api/admin/expenses?month=${targetMonth}`, {
        cache: "no-store",
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Unable to load admin expenses.");
      }
      const payload = (await response.json()) as { expenses: AdminExpense[] };
      setExpenses(payload.expenses);
      setStatus(`Showing expense totals for ${targetMonth}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load admin expenses.");
    }
  }

  useEffect(() => {
    void loadExpenses(month);
  }, [month]);

  function applyPreset(nextMode: MonthSelectionMode) {
    const nextRange = getPreviousMonthRange();
    setMode(nextMode);
    setMonth(nextRange.month);
  }

  function applyCustomMonth(nextMonth: string) {
    if (!nextMonth) return;
    setMode("custom");
    setMonth(nextMonth);
  }

  const monthLabel = formatMonthKey(month);

  function openDetails(row: GroupedRow, event: MouseEvent<HTMLButtonElement>) {
    const viewportHeight = window.innerHeight;
    const nextTop = Math.min(Math.max(16, event.currentTarget.getBoundingClientRect().top - 24), Math.max(16, viewportHeight - 280));
    setModalAnchorTop(nextTop);
    setOpenRow(row);
  }

  async function handleMarkPaid(row: GroupedRow) {
    setStatus(`Marking ${row.name}'s ${monthLabel} expenses as paid...`);
    try {
      const response = await fetch("/api/admin/expenses/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          membershipId: row.membershipId,
          month
        })
      });
      const payload = (await response.json()) as { ok?: boolean; updatedCount?: number; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Unable to mark expenses as paid.");
      }

      await loadExpenses(month);
      setStatus(
        payload.updatedCount && payload.updatedCount > 0
          ? `${row.name}'s expenses were marked as paid.`
          : `${row.name} already had all expenses paid for ${monthLabel}.`
      );
      setOpenRow(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to mark expenses as paid.");
    }
  }

  return (
    <div className="space-y-5">
      {previewExpense ? (
        <InvoicePreviewModal
          title={`${previewExpense.memberName} · ${previewExpense.fileName}`}
          src={`/api/admin/expenses/${previewExpense.id}/download`}
          mimeType={previewExpense.mimeType}
          onClose={() => setPreviewExpense(null)}
          anchorTop={previewAnchorTop}
        />
      ) : null}
      {openRow ? (
        <AdminModalShell
          title={openRow.name}
          subtitle={`${monthLabel} · ${openRow.expenses.length} expenses · ${formatUsd(openRow.totalAmount)}`}
          onClose={() => setOpenRow(null)}
          sizeClassName="max-w-4xl"
          zIndexClassName="z-[65]"
          anchorTop={modalAnchorTop}
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                className="border border-border bg-background"
                onClick={() => {
                  setStatus(`Preparing ${openRow.expenses.length} receipts for ${openRow.name}...`);
                  window.location.href = `/api/admin/expenses/download-all?membershipId=${encodeURIComponent(openRow.membershipId)}&month=${encodeURIComponent(month)}`;
                }}
                disabled={openRow.expenses.length === 0}
              >
                Download all
              </Button>
              <Button
                type="button"
                onClick={() => void handleMarkPaid(openRow)}
                disabled={openRow.expenses.length === 0 || openRow.unpaidTotalAmount <= 0}
              >
                Mark all as paid
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{formatUsd(openRow.totalAmount)}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Unpaid</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{formatUsd(openRow.unpaidTotalAmount)}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid lines</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{openRow.paidCount}</p>
              </div>
            </div>
            {openRow.expenses.length ? (
              openRow.expenses.map((expense) => (
                <div key={expense.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{expense.reference}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(`${expense.expenseDate}T12:00:00`), "MMM d, yyyy")} · {formatUsd(expense.totalAmount)} · {expense.fileName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatFileSize(expense.fileSizeBytes)} · Uploaded {format(new Date(expense.updatedAt), "MMM d, yyyy p")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {expense.paidAt ? `Paid ${format(new Date(expense.paidAt), "MMM d, yyyy p")}` : "Unpaid"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <span
                      className={cn(
                        "inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-semibold",
                        expense.paidAt ? "bg-success text-success-foreground" : "bg-muted text-foreground"
                      )}
                    >
                      {expense.paidAt ? "Paid" : "Unpaid"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="border border-border bg-background"
                      onClick={(event) => {
                        const viewportHeight = window.innerHeight;
                        const nextTop = Math.min(Math.max(16, event.currentTarget.getBoundingClientRect().top - 24), Math.max(16, viewportHeight - 280));
                        setPreviewAnchorTop(nextTop);
                        setPreviewExpense({ ...expense, memberName: openRow.name });
                      }}
                    >
                      View receipt
                    </Button>
                    <Link
                      href={`/api/admin/expenses/${expense.id}/download?download=1`}
                      className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-nav-selected"
                    >
                      Download receipt
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
                No expenses saved for {monthLabel}.
              </div>
            )}
          </div>
        </AdminModalShell>
      ) : null}

      <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-muted/90 to-transparent sm:hidden" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-muted/90 to-transparent sm:hidden" />
          <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Expense month presets">
            <div className="inline-flex min-w-max snap-x snap-mandatory items-center gap-2">
              {PRESETS.map((preset) => (
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
                  {getMonthModeLabel(preset)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMode("custom")}
                aria-pressed={mode === "custom"}
                className={cn(
                  "inline-flex h-9 shrink-0 snap-start items-center rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  mode === "custom"
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
            <span className="font-semibold text-foreground">Expense month:</span>{" "}
            <span className="font-medium text-foreground">{monthLabel}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Review monthly reimbursable expenses and total amount owed per employee.</p>
        </div>

        {mode === "custom" ? (
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Month</span>
            <Input type="month" value={month} className="min-w-0" onChange={(event) => applyCustomMonth(event.target.value)} />
          </label>
        ) : null}
      </div>

      <div className="rounded-md bg-accent/40 px-3 py-2 text-sm text-accent-foreground">{status}</div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.expected}</p>
          <p className="mt-1 text-xs text-muted-foreground">Employees shown for the selected reimbursement month.</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Submitted</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.uploaded}</p>
          <p className="mt-1 text-xs text-muted-foreground">Employees with at least one expense line in the selected month.</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total owed</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatUsd(summary.totalAmount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Combined reimbursement amount for the selected month.</p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.membershipId} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.email}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="text-left sm:text-right">
                <p className="text-sm font-semibold text-foreground">{formatUsd(row.totalAmount)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.expenses.length} expense{row.expenses.length === 1 ? "" : "s"} in {monthLabel}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.unpaidTotalAmount > 0 ? `${formatUsd(row.unpaidTotalAmount)} unpaid` : "All paid"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="border border-border bg-background"
                onClick={(event) => openDetails(row, event)}
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
