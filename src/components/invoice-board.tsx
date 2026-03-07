"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { InvoicePreviewModal } from "@/components/invoice-preview-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/file-size";
import {
  getMonthModeLabel,
  getPreviousMonthRange,
  getRangeForMonth,
  type MonthSelectionMode
} from "@/lib/month-range";

type InvoiceRecord = {
  id: string;
  invoiceMonth: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
};

const PRESETS: Array<Exclude<MonthSelectionMode, "custom" | "current" | "next">> = ["previous"];

function isExpectedInvoiceMonth(month: string) {
  return month <= getPreviousMonthRange().month;
}

export function InvoiceBoard() {
  const previous = getPreviousMonthRange();
  const [month, setMonth] = useState(previous.month);
  const [mode, setMode] = useState<MonthSelectionMode>("previous");
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [allInvoices, setAllInvoices] = useState<InvoiceRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Loading invoice status...");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const range = useMemo(() => getRangeForMonth(month), [month]);
  const monthLabel = useMemo(() => format(new Date(`${month}-01T12:00:00`), "MMMM yyyy"), [month]);
  const isExpectedMonth = useMemo(() => isExpectedInvoiceMonth(month), [month]);

  async function loadInvoice(targetMonth = month) {
    setIsBusy(true);
    setError(null);
    try {
      const [selectedResponse, allResponse] = await Promise.all([
        fetch(`/api/invoices?month=${targetMonth}`, {
          cache: "no-store",
          credentials: "include"
        }),
        fetch("/api/invoices?all=1", {
          cache: "no-store",
          credentials: "include"
        })
      ]);
      if (!selectedResponse.ok) {
        throw new Error("Unable to load invoice status.");
      }
      if (!allResponse.ok) {
        throw new Error("Unable to load uploaded invoices.");
      }
      const selectedPayload = (await selectedResponse.json()) as { invoice: InvoiceRecord | null };
      const allPayload = (await allResponse.json()) as { invoices: InvoiceRecord[] };
      setInvoice(selectedPayload.invoice);
      setAllInvoices(allPayload.invoices);
      setStatus(
        selectedPayload.invoice
          ? `Invoice uploaded for ${targetMonth}.`
          : isExpectedInvoiceMonth(targetMonth)
            ? `No invoice uploaded for ${targetMonth}.`
            : `${targetMonth} is not due yet.`
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load invoice status.");
      setStatus("Invoice status unavailable.");
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void loadInvoice(month);
  }, [month]);

  function applyPreset(nextMode: Exclude<MonthSelectionMode, "custom" | "current" | "next">) {
    const nextRange = getPreviousMonthRange();
    setMode(nextMode);
    setMonth(nextRange.month);
    setSelectedFile(null);
  }

  function applyCustomMonth(nextMonth: string) {
    if (!nextMonth) return;
    setMode("custom");
    setMonth(nextMonth);
    setSelectedFile(null);
  }

  async function handleUpload() {
    if (!selectedFile) return;

    setIsBusy(true);
    setError(null);
    setStatus(invoice ? "Replacing invoice..." : "Uploading invoice...");

    try {
      const formData = new FormData();
      formData.append("month", month);
      formData.append("file", selectedFile);

      const response = await fetch("/api/invoices", {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      const payload = (await response.json()) as { invoice?: InvoiceRecord; error?: string };
      if (!response.ok || !payload.invoice) {
        throw new Error(payload.error ?? "Unable to upload invoice.");
      }

      setInvoice(payload.invoice);
      setAllInvoices((currentInvoices) => {
        const nextInvoices = currentInvoices.filter((currentInvoice) => currentInvoice.invoiceMonth !== payload.invoice!.invoiceMonth);
        nextInvoices.unshift(payload.invoice!);
        return nextInvoices.sort((left, right) => right.invoiceMonth.localeCompare(left.invoiceMonth));
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStatus(`Invoice saved for ${month}.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload invoice.");
      setStatus("Invoice upload failed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {previewInvoice ? (
        <InvoicePreviewModal
          title={previewInvoice.fileName}
          src={`/api/invoices/${previewInvoice.id}/download`}
          onClose={() => setPreviewInvoice(null)}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Upload one PDF invoice per month. Re-uploading the same month replaces the existing file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <span className="font-semibold text-foreground">Selected month:</span>{" "}
                <span className="font-medium text-foreground">{monthLabel}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {range.from} to {range.to}
              </p>
            </div>

            {mode === "custom" ? (
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-foreground">Month</span>
                <Input type="month" value={month} className="min-w-0" onChange={(event) => applyCustomMonth(event.target.value)} />
              </label>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Upload or replace invoice</p>
                  <p className="mt-1 text-sm text-muted-foreground">PDF only. Max file size 10 MB. Invoices are expected only for previous months. Current month upload is optional until the month closes.</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    invoice ? "bg-success text-success-foreground" : isExpectedMonth ? "bg-muted text-foreground" : "bg-accent text-accent-foreground"
                  )}
                >
                  {invoice ? "Uploaded" : isExpectedMonth ? "Missing" : "Not due yet"}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="ghost" className="w-full border border-border bg-background" onClick={() => fileInputRef.current?.click()}>
                  {invoice ? "Choose replacement PDF" : "Choose PDF invoice"}
                </Button>
                <div className="rounded-lg border border-dashed border-border px-3 py-3 text-sm">
                  {selectedFile ? (
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No PDF selected yet.</p>
                  )}
                </div>
                <Button type="button" className="w-full" onClick={() => void handleUpload()} disabled={!selectedFile || isBusy}>
                  {isBusy ? "Processing..." : invoice ? "Replace invoice" : "Upload invoice"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Selected month status</p>
              {invoice ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{invoice.fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(invoice.fileSizeBytes)} · Uploaded {format(new Date(invoice.updatedAt), "MMM d, yyyy p")}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="ghost" className="border border-border bg-background" onClick={() => setPreviewInvoice(invoice)}>
                      View PDF
                    </Button>
                    <Link
                      href={`/api/invoices/${invoice.id}/download?download=1`}
                      className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-nav-selected"
                    >
                      Download PDF
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                  {isExpectedMonth ? "No invoice has been uploaded for this month yet." : "This month is not expected yet. You can still upload early if you want."}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md bg-accent/40 px-3 py-2 text-sm text-accent-foreground" aria-live="polite">
            {status}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">All uploaded invoices</p>
                <p className="mt-1 text-sm text-muted-foreground">Every invoice you have already uploaded is listed here. The month selector above only controls the target month for uploading or replacing.</p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                {allInvoices.length} uploaded
              </span>
            </div>

            {allInvoices.length ? (
              <div className="mt-4 space-y-3">
                {allInvoices.map((uploadedInvoice) => (
                  <div key={uploadedInvoice.id} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{format(new Date(`${uploadedInvoice.invoiceMonth}-01T12:00:00`), "MMMM yyyy")}</p>
                      <p className="truncate text-sm text-foreground">{uploadedInvoice.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(uploadedInvoice.fileSizeBytes)} · Uploaded {format(new Date(uploadedInvoice.updatedAt), "MMM d, yyyy p")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="ghost" className="border border-border bg-background" onClick={() => setPreviewInvoice(uploadedInvoice)}>
                        View PDF
                      </Button>
                      <Link
                        href={`/api/invoices/${uploadedInvoice.id}/download?download=1`}
                        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-nav-selected"
                      >
                        Download PDF
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">You have not uploaded any invoices yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
