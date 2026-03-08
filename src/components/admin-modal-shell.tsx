"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function AdminModalShell({
  title,
  subtitle,
  onClose,
  children,
  actions,
  sizeClassName,
  bodyClassName,
  zIndexClassName = "z-[70]",
  anchorTop: _anchorTop = 24
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  sizeClassName?: string;
  bodyClassName?: string;
  zIndexClassName?: string;
  anchorTop?: number;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const frame = window.requestAnimationFrame(() => {
      modal.scrollIntoView({ block: "center", inline: "nearest" });

      const firstFocusable = modal.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      const target = firstFocusable ?? modal;
      target.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={cn("fixed inset-0 overflow-y-auto overscroll-contain bg-foreground/35 p-4", zIndexClassName)}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex min-h-full items-center justify-center py-4">
        <div
          ref={modalRef}
          tabIndex={-1}
          className={cn(
            "flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg",
            sizeClassName
          )}
          style={{ maxHeight: "calc(100vh - 32px)" }}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">{title}</p>
              {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              <Button type="button" variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
          <div className={cn("overflow-y-auto overscroll-contain p-4", bodyClassName)}>{children}</div>
        </div>
      </div>
    </div>
  );
}
