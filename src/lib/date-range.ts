import { addDays, addWeeks, formatISO, startOfWeek } from "date-fns";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SelectionMode = "current" | "previous" | "next" | "custom";

export type DateRange = {
  from: string;
  to: string;
};

function toDateOnly(value: Date) {
  return formatISO(value, { representation: "date" });
}

export function getCurrentWeekRange(weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1): DateRange {
  const weekStart = startOfWeek(new Date(), { weekStartsOn });
  return {
    from: toDateOnly(weekStart),
    to: toDateOnly(addDays(weekStart, 6))
  };
}

export function getPreviousWeekRange(weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1): DateRange {
  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn }), -1);
  return {
    from: toDateOnly(weekStart),
    to: toDateOnly(addDays(weekStart, 6))
  };
}

export function getNextWeekRange(weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1): DateRange {
  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn }), 1);
  return {
    from: toDateOnly(weekStart),
    to: toDateOnly(addDays(weekStart, 6))
  };
}

export function normalizeRange(from: string, to: string): DateRange {
  if (!DATE_RE.test(from) && !DATE_RE.test(to)) {
    return getCurrentWeekRange();
  }

  if (!DATE_RE.test(from) && DATE_RE.test(to)) {
    return { from: to, to };
  }

  if (DATE_RE.test(from) && !DATE_RE.test(to)) {
    return { from, to: from };
  }

  return to < from ? { from, to: from } : { from, to };
}

export function detectSelectionMode(
  from: string,
  to: string,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1
): SelectionMode {
  const normalized = normalizeRange(from, to);
  const current = getCurrentWeekRange(weekStartsOn);
  const previous = getPreviousWeekRange(weekStartsOn);
  const next = getNextWeekRange(weekStartsOn);

  if (normalized.from === current.from && normalized.to === current.to) return "current";
  if (normalized.from === previous.from && normalized.to === previous.to) return "previous";
  if (normalized.from === next.from && normalized.to === next.to) return "next";
  return "custom";
}

export function getModeLabel(mode: SelectionMode) {
  if (mode === "current") return "Current week";
  if (mode === "previous") return "Previous week";
  if (mode === "next") return "Next week";
  return "Custom date";
}
