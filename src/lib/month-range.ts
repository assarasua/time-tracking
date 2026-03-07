import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";

export type MonthSelectionMode = "previous" | "custom";

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

export function getPreviousMonthRange() {
  return buildMonthRange(subMonths(new Date(), 1));
}

export function getRangeForMonth(month: string): MonthRange {
  const [year, monthNumber] = month.split("-").map(Number);
  return buildMonthRange(new Date(year, monthNumber - 1, 1));
}

export function getMonthModeLabel(mode: MonthSelectionMode) {
  if (mode === "previous") return "Previous month";
  return "Custom month";
}

export function formatMonthKey(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  return format(new Date(year, monthIndex, 1), "MMMM yyyy");
}
