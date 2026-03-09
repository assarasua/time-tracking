import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type DatePickerInputProps = InputHTMLAttributes<HTMLInputElement> & {
  pickerType: "date" | "month";
};

function CalendarGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 3.75V7.25M17 3.75V7.25M3.5 9.5H20.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export const DatePickerInput = forwardRef<HTMLInputElement, DatePickerInputProps>(function DatePickerInput(
  { className, pickerType, ...props },
  ref
) {
  return (
    <div className="group relative">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-nav-selected">
        <CalendarGlyph className="h-4 w-4" />
      </div>
      <input
        ref={ref}
        type={pickerType}
        className={cn(
          "flex h-11 w-full rounded-xl border border-border bg-card pl-10 pr-24 text-sm font-medium text-foreground shadow-sm ring-offset-background transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "[color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80",
          className
        )}
        {...props}
      />
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {pickerType === "date" ? "Date" : "Month"}
        </span>
      </div>
    </div>
  );
});
