"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type ExportDownloadButtonProps = {
  href: string;
  label: string;
  className?: string;
  variant?: "primary" | "secondary" | "destructive" | "ghost";
};

export function ExportDownloadButton({ href, label, className, variant = "primary" }: ExportDownloadButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (isProcessing) return;

    setError(null);
    setIsProcessing(true);

    try {
      const response = await fetch(href, {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Unable to generate CSV. Please retry.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename=([^;]+)/i);
      const filename = filenameMatch?.[1]?.replaceAll('"', "") ?? "export.csv";

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to generate CSV. Please retry.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={handleDownload} className={className} variant={variant} disabled={isProcessing}>
        {isProcessing ? "Processing..." : label}
      </Button>

      {isProcessing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xs rounded-lg border border-border bg-card p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
              <p className="text-sm font-medium text-foreground">Processing download...</p>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </>
  );
}
