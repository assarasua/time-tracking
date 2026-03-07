"use client";

import { Button } from "@/components/ui/button";

export function InvoicePreviewModal({
  title,
  src,
  onClose
}: {
  title: string;
  src: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-foreground/35 p-4 pt-12 sm:pt-16" role="dialog" aria-modal="true">
      <div className="flex h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">Inline PDF preview</p>
          </div>
          <Button type="button" variant="ghost" className="shrink-0" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="min-h-0 flex-1 bg-muted/30 p-2 sm:p-3">
          <iframe title={title} src={src} className="h-full w-full rounded-lg border border-border bg-background" />
        </div>
      </div>
    </div>
  );
}
