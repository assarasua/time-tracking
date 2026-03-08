"use client";

import { AdminModalShell } from "@/components/admin-modal-shell";

export function InvoicePreviewModal({
  title,
  src,
  mimeType = "application/pdf",
  onClose,
  anchorTop = 24
}: {
  title: string;
  src: string;
  mimeType?: string;
  onClose: () => void;
  anchorTop?: number;
}) {
  const isImage = mimeType.startsWith("image/");

  return (
    <AdminModalShell
      title={title}
      subtitle={isImage ? "Inline receipt preview" : "Inline PDF preview"}
      onClose={onClose}
      sizeClassName="max-w-5xl"
      bodyClassName="bg-muted/30 p-2 sm:p-3"
      anchorTop={anchorTop}
    >
      <div className="h-[72vh]">
        {isImage ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-border bg-background p-3">
            <img src={src} alt={title} className="max-h-full max-w-full rounded-md object-contain" />
          </div>
        ) : (
          <iframe title={title} src={src} className="h-full w-full rounded-lg border border-border bg-background" />
        )}
      </div>
    </AdminModalShell>
  );
}
