import { addDays, getDay, lastDayOfMonth } from "date-fns";

export type CaliforniaHoliday = {
  date: string;
  name: string;
};

function toDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateToUtcKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, nth: number) {
  const first = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const delta = (weekday - getDay(first) + 7) % 7;
  return addDays(first, delta + (nth - 1) * 7);
}

function lastWeekdayOfMonth(year: number, monthIndex: number, weekday: number) {
  const last = lastDayOfMonth(new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)));
  const delta = (getDay(last) - weekday + 7) % 7;
  return addDays(last, -delta);
}

function observedDate(year: number, monthIndex: number, day: number, options?: { saturday?: "same" | "friday"; sunday?: "same" | "monday" }) {
  const base = new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
  const weekday = getDay(base);

  if (weekday === 6) {
    if (options?.saturday === "friday") return addDays(base, -1);
    return base;
  }

  if (weekday === 0) {
    if (options?.sunday === "monday") return addDays(base, 1);
    return base;
  }

  return base;
}

export function getCaliforniaPublicHolidays(from: string, to: string) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const years: number[] = [];
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
    years.push(year);
  }

  const holidays = new Map<string, CaliforniaHoliday>();

  for (const year of years) {
    const entries: Array<{ date: Date; name: string }> = [
      { date: observedDate(year, 0, 1, { saturday: "same", sunday: "monday" }), name: "New Year's Day" },
      { date: nthWeekdayOfMonth(year, 0, 1, 3), name: "Martin Luther King Jr. Day" },
      { date: nthWeekdayOfMonth(year, 1, 1, 3), name: "Presidents' Day" },
      { date: new Date(Date.UTC(year, 2, 31, 0, 0, 0, 0)), name: "Cesar Chavez Day" },
      { date: lastWeekdayOfMonth(year, 4, 1), name: "Memorial Day" },
      { date: observedDate(year, 6, 4, { saturday: "same", sunday: "monday" }), name: "Independence Day" },
      { date: nthWeekdayOfMonth(year, 8, 1, 1), name: "Labor Day" },
      { date: observedDate(year, 10, 11, { saturday: "friday", sunday: "monday" }), name: "Veterans Day" },
      { date: nthWeekdayOfMonth(year, 10, 4, 4), name: "Thanksgiving Day" },
      { date: addDays(nthWeekdayOfMonth(year, 10, 4, 4), 1), name: "Day after Thanksgiving" },
      { date: observedDate(year, 11, 25, { saturday: "same", sunday: "monday" }), name: "Christmas Day" }
    ];

    for (const entry of entries) {
      const key = dateToUtcKey(entry.date);
      holidays.set(key, { date: key, name: entry.name });
    }
  }

  return [...holidays.values()].filter((holiday) => holiday.date >= from && holiday.date <= to);
}

export function getCaliforniaPublicHolidaysByDate(from: string, to: string) {
  return new Map(getCaliforniaPublicHolidays(from, to).map((holiday) => [holiday.date, holiday]));
}

export function isCaliforniaPublicHoliday(date: string, from: string, to: string) {
  return getCaliforniaPublicHolidaysByDate(from, to).has(date);
}

export function formatCaliforniaHolidayKey(year: number, monthIndex: number, day: number) {
  return toDateKey(year, monthIndex, day);
}
