export function PageLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      <div className="h-20 rounded-2xl border border-border bg-card/80" />
      <div className="h-40 rounded-xl border border-border bg-card/80" />
      <div className="h-64 rounded-xl border border-border bg-card/80" />
    </div>
  );
}
