"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { InvoicePreviewModal } from "@/components/invoice-preview-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatUsd } from "@/lib/currency";
import { formatFileSize } from "@/lib/file-size";
import { formatMonthKey, getMonthModeLabel, getPreviousMonthRange, type MonthSelectionMode } from "@/lib/month-range";

type ExpenseRecord = {
  id: string;
  expenseMonth: string;
  expenseDate: string;
  reference: string;
  totalAmount: number;
  currency: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const PRESETS: MonthSelectionMode[] = ["previous"];

export function ExpenseBoard() {
  const previous = getPreviousMonthRange();
  const [month, setMonth] = useState(previous.month);
  const [mode, setMode] = useState<MonthSelectionMode>("previous");
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [expenseDate, setExpenseDate] = useState(previous.from);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Loading expenses...");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [previewExpense, setPreviewExpense] = useState<ExpenseRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const monthLabel = useMemo(() => formatMonthKey(month), [month]);
  const monthlyTotal = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.totalAmount, 0),
    [expenses]
  );

  async function loadExpenses(targetMonth = month) {
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/expenses?month=${targetMonth}`, {
        cache: "no-store",
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Unable to load expenses.");
      }

      const payload = (await response.json()) as { expenses: ExpenseRecord[] };
      setExpenses(payload.expenses);
      setStatus(
        payload.expenses.length
          ? `Showing ${payload.expenses.length} expenses for ${targetMonth}.`
          : `No expenses saved for ${targetMonth}.`
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load expenses.");
      setStatus("Expense status unavailable.");
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    setExpenseDate(`${month}-01`);
    void loadExpenses(month);
  }, [month]);

  function applyPreset(nextMode: MonthSelectionMode) {
    const nextRange = getPreviousMonthRange();
    setMode(nextMode);
    setMonth(nextRange.month);
    setExpenseDate(nextRange.from);
    setSelectedFile(null);
  }

  function applyCustomMonth(nextMonth: string) {
    if (!nextMonth) return;
    setMode("custom");
    setMonth(nextMonth);
    setExpenseDate(`${nextMonth}-01`);
    setSelectedFile(null);
  }

  async function handleUpload() {
    if (!selectedFile) return;

    setIsBusy(true);
    setError(null);
    setStatus("Uploading expense...");

    try {
      const formData = new FormData();
      formData.append("month", month);
      formData.append("expense_date", expenseDate);
      formData.append("total_amount", amount);
      formData.append("reference", reference);
      formData.append("file", selectedFile);

      const response = await fetch("/api/expenses", {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      const payload = (await response.json()) as { expense?: ExpenseRecord; error?: string };
      if (!response.ok || !payload.expense) {
        throw new Error(payload.error ?? "Unable to upload expense.");
      }

      setExpenses((currentExpenses) =>
        [payload.expense!, ...currentExpenses].sort((left, right) =>
          `${right.expenseDate}-${right.updatedAt}`.localeCompare(`${left.expenseDate}-${left.updatedAt}`)
        )
      );
      setAmount("");
      setReference("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStatus(`Expense saved for ${month}.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload expense.");
      setStatus("Expense upload failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(targetExpense: ExpenseRecord) {
    setIsBusy(true);
    setError(null);
    setStatus(`Deleting expense from ${targetExpense.expenseDate}...`);

    try {
      const response = await fetch(`/api/expenses/${targetExpense.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Unable to delete expense.");
      }

      setExpenses((currentExpenses) => currentExpenses.filter((currentExpense) => currentExpense.id !== targetExpense.id));
      if (previewExpense?.id === targetExpense.id) {
        setPreviewExpense(null);
      }
      setStatus(`Expense deleted for ${targetExpense.expenseDate}.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete expense.");
      setStatus("Expense delete failed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {previewExpense ? (
        <InvoicePreviewModal
          title={previewExpense.fileName}
          src={`/api/expenses/${previewExpense.id}/download`}
          mimeType={previewExpense.mimeType}
          onClose={() => setPreviewExpense(null)}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
          <CardDescription>Add monthly reimbursable expenses with the exact date, total amount, reference, and receipt file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <span className="font-semibold text-foreground">Selected month:</span>{" "}
                <span className="font-medium text-foreground">{monthLabel}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Month bucket used for reimbursement and admin monthly totals.</p>
            </div>

            {mode === "custom" ? (
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-foreground">Month</span>
                <Input type="month" value={month} className="min-w-0" onChange={(event) => applyCustomMonth(event.target.value)} />
              </label>
            ) : null}
          </div>

          <div className="rounded-md bg-accent/40 px-3 py-2 text-sm text-accent-foreground">{status}</div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Monthly total</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatUsd(monthlyTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {expenses.length} expense{expenses.length === 1 ? "" : "s"} saved for {monthLabel}.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Currency</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">USD</p>
              <p className="mt-1 text-xs text-muted-foreground">All monthly totals and admin reimbursement rows are shown in dollars.</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4">
            <div className="space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-foreground">Expense date</span>
                <Input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-foreground">Total amount (USD)</span>
                <Input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-foreground">Reference</span>
                <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Flight to client site, taxi, hotel, software receipt..." />
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                className="hidden"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="ghost" className="w-full border border-border bg-background" onClick={() => fileInputRef.current?.click()}>
                Choose receipt file
              </Button>
              <div className="rounded-lg border border-dashed border-border px-3 py-3 text-sm">
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No receipt selected yet.</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Accepted formats: PDF, PNG, JPG, JPEG. Maximum 10 MB.</p>
              <Button type="button" className="w-full" onClick={() => void handleUpload()} disabled={isBusy || !selectedFile}>
                Add expense
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{monthLabel} expenses</CardTitle>
          <CardDescription>Every saved expense line for the selected month, with exact date and receipt actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {expenses.length ? (
            expenses.map((expense) => (
              <div key={expense.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{expense.reference}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(`${expense.expenseDate}T12:00:00`), "MMM d, yyyy")} · {formatUsd(expense.totalAmount)} · {expense.fileName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Uploaded {format(new Date(expense.updatedAt), "MMM d, yyyy p")}
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
                    onClick={() => setPreviewExpense(expense)}
                  >
                    View receipt
                  </Button>
                  <Link
                    href={`/api/expenses/${expense.id}/download?download=1`}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-nav-selected"
                  >
                    Download receipt
                  </Link>
                  <Button type="button" variant="ghost" className="border border-border bg-background text-destructive hover:text-destructive" onClick={() => void handleDelete(expense)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
              No expenses saved for {monthLabel} yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
