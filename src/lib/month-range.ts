import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";

export type MonthSelectionMode = "previous" | "current" | "next" | "custom";

export type MonthRange = {
  month: string;
  from: string;
  to: string;
};

function buildMonthRange(base: Date): MonthRange {
  const monthStart = startOfMonth(base);
  return {
    month: format(monthStart, "yyyy-MM"),
    from: format(monthStart, "yyyy-MM-dd"),
    to: format(endOfMonth(monthStart), "yyyy-MM-dd")
  };
}

export function getCurrentMonthRange() {
  return buildMonthRange(new Date());
}

export function getPreviousMonthRange() {
  return buildMonthRange(subMonths(new Date(), 1));
}

export function getNextMonthRange() {
  return buildMonthRange(addMonths(new Date(), 1));
}

export function getRangeForMonth(month: string): MonthRange {
  const [year, monthNumber] = month.split("-").map(Number);
  return buildMonthRange(new Date(year, monthNumber - 1, 1));
}

export function detectMonthMode(month: string): MonthSelectionMode {
  if (month === getCurrentMonthRange().month) return "current";
  if (month === getPreviousMonthRange().month) return "previous";
  if (month === getNextMonthRange().month) return "next";
  return "custom";
}

export function getMonthModeLabel(mode: MonthSelectionMode) {
  if (mode === "previous") return "Previous month";
  if (mode === "next") return "Next month";
  if (mode === "current") return "Current month";
  return "Custom month";
}
