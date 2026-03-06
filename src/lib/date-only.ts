import { format } from "date-fns";

export function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatDateOnly(value: string, pattern: string) {
  return format(parseDateOnly(value), pattern);
}
