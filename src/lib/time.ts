import { addDays, differenceInMinutes, endOfDay, endOfWeek, startOfDay, startOfWeek } from "date-fns";

export function getWeekRange(date: Date, weekStartsOn = 1) {
  const weekStart = startOfWeek(date, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  const weekEnd = endOfWeek(date, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });

  return { weekStart, weekEnd };
}

export function minutesBetween(startAt: Date, endAt: Date) {
  return Math.max(0, differenceInMinutes(endAt, startAt));
}

export function weekStartFromParam(param: string, weekStartsOn = 1) {
  const parsed = new Date(`${param}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid week_start date. Expected YYYY-MM-DD");
  }
  return startOfWeek(parsed, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
}

export function getBusinessDaysInWeek(weekStart: Date) {
  const days: Date[] = [];
  for (let i = 0; i < 5; i += 1) {
    days.push(startOfDay(addDays(weekStart, i)));
  }
  return days;
}

export function endOfBusinessDay(date: Date) {
  return endOfDay(date);
}
