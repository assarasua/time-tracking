"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";

import { InvoicePreviewModal } from "@/components/invoice-preview-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatUsd } from "@/lib/currency";
import { formatDateOnly } from "@/lib/date-only";
import { formatFileSize } from "@/lib/file-size";
import {
  formatMonthKey,
  getMonthModeLabel,
  getPreviousMonthRange,
  type MonthSelectionMode
} from "@/lib/month-range";

type MemberRow = {
  membershipId: string;
  name: string;
  email: string;
};

type AdminInvoice = {
  id: string;
  organizationUserId: string;
  invoiceMonth: string;
  invoiceDate: string;
  totalAmount: number;
  fileName: string;
  fileSizeBytes: number;
  paidAt: string | null;
  updatedAt: string;
};

const PRESETS: MonthSelectionMode[] = ["previous"];

function isExpectedInvoiceMonth(month: string) {
  return month <= getPreviousMonthRange().month;
}

export function AdminInvoicesSummary({ members }: { members: MemberRow[] }) {
  const previous = getPreviousMonthRange();
  const [month, setMonth] = useState(previous.month);
  const [mode, setMode] = useState<MonthSelectionMode>("previous");
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [status, setStatus] = useState("Loading invoice coverage...");
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<(AdminInvoice & { memberName: string }) | null>(null);
  const [previewAnchorTop, setPreviewAnchorTop] = useState(24);

  const rows = useMemo(() => {
    const byMembership = new Map(invoices.map((invoice) => [invoice.organizationUserId, invoice]));
    return members.map((member) => ({
      ...member,
      invoice: byMembership.get(member.membershipId) ?? null
    }));
  }, [invoices, members]);
  const isExpectedMonth = useMemo(() => isExpectedInvoiceMonth(month), [month]);

  const summary = useMemo(() => ({
    expected: isExpectedMonth ? rows.length : 0,
    uploaded: rows.filter((row) => row.invoice).length,
    missing: isExpectedMonth ? rows.filter((row) => !row.invoice).length : 0
  }), [isExpectedMonth, rows]);

  async function loadInvoices(targetMonth = month) {
    setStatus("Loading invoice coverage...");
    try {
      const response = await fetch(`/api/admin/invoices?month=${targetMonth}`, {
        cache: "no-store",
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Unable to load admin invoices.");
      }
      const payload = (await response.json()) as { invoices: AdminInvoice[] };
      setInvoices(payload.invoices);
      setStatus(isExpectedInvoiceMonth(targetMonth) ? `Showing invoice status for ${targetMonth}.` : `Showing optional upload status for ${targetMonth}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load admin invoices.");
    }
  }

  useEffect(() => {
    void loadInvoices(month);
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

  async function handleMarkPaid(invoiceId: string) {
    setBusyInvoiceId(invoiceId);
    setStatus("Marking invoice as paid...");
    try {
      const response = await fetch("/api/admin/invoices/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ invoiceId })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Unable to mark invoice as paid.");
      }

      await loadInvoices(month);
      setStatus(`Invoice marked as paid for ${month}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to mark invoice as paid.");
    } finally {
      setBusyInvoiceId(null);
    }
  }

  const monthLabel = formatMonthKey(month);

  return (
    <div className="space-y-5">
      {previewInvoice ? (
        <InvoicePreviewModal
          title={`${previewInvoice.memberName} · ${previewInvoice.fileName}`}
          src={`/api/admin/invoices/${previewInvoice.id}/download`}
          onClose={() => setPreviewInvoice(null)}
          anchorTop={previewAnchorTop}
        />
      ) : null}
      <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-muted/90 to-transparent sm:hidden" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-muted/90 to-transparent sm:hidden" />
          <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Invoice month presets">
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
            <span className="font-semibold text-foreground">Invoice month:</span>{" "}
            <span className="font-medium text-foreground">{monthLabel}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Review uploaded and missing invoices for the selected payroll month.</p>
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
          <p className="mt-1 text-xs text-muted-foreground">
            {isExpectedMonth ? `Employees expected to upload one invoice for ${monthLabel}.` : `${monthLabel} is not due yet, so no invoice is counted as missing.`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Uploaded</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.uploaded}</p>
          <p className="mt-1 text-xs text-muted-foreground">Invoices available for admin review.</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Missing</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.missing}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isExpectedMonth ? "Employees still missing an invoice for the selected month." : "No missing count while the selected month is still open."}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const invoice = row.invoice;

          return (
            <div key={row.membershipId} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.email}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <div className="text-left sm:text-right">
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", invoice ? "bg-success text-success-foreground" : isExpectedMonth ? "bg-muted text-foreground" : "bg-accent text-accent-foreground")}>
                      {invoice ? "Uploaded" : isExpectedMonth ? "Missing" : "Not due yet"}
                    </span>
                    {invoice ? (
                      <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", invoice.paidAt ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                        {invoice.paidAt ? "Paid" : "Unpaid"}
                      </span>
                    ) : null}
                  </div>
                  {invoice ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-semibold text-foreground">{formatUsd(invoice.totalAmount)}</p>
                      <p className="text-xs text-muted-foreground">Invoice date {formatDateOnly(invoice.invoiceDate, "MMM d, yyyy")}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.fileName} · {formatFileSize(invoice.fileSizeBytes)} · {format(new Date(invoice.updatedAt), "MMM d, yyyy p")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.paidAt ? `Paid ${format(new Date(invoice.paidAt), "MMM d, yyyy p")}` : "Pending payment"}
                      </p>
                    </div>
                  ) : null}
                </div>
                {invoice ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="ghost"
                      className="border border-border bg-background"
                      onClick={(event: MouseEvent<HTMLButtonElement>) => {
                        const viewportHeight = window.innerHeight;
                        const nextTop = Math.min(Math.max(16, event.currentTarget.getBoundingClientRect().top - 24), Math.max(16, viewportHeight - 280));
                        setPreviewAnchorTop(nextTop);
                        setPreviewInvoice({ ...invoice, memberName: row.name });
                      }}
                    >
                      View PDF
                    </Button>
                    <Link href={`/api/admin/invoices/${invoice.id}/download?download=1`} className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-nav-selected">
                      Download PDF
                    </Link>
                    {!invoice.paidAt ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="border border-border bg-background"
                        onClick={() => void handleMarkPaid(invoice.id)}
                        disabled={busyInvoiceId === invoice.id}
                      >
                        {busyInvoiceId === invoice.id ? "Processing..." : "Mark as paid"}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
