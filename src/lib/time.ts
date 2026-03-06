import { addDays, differenceInMinutes, endOfDay, endOfWeek, format, startOfDay, startOfWeek } from "date-fns";

export function getWeekRange(date: Date, weekStartsOn = 1) {
  const weekStart = startOfWeek(date, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  const weekEnd = endOfWeek(date, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });

  return { weekStart, weekEnd };
}

export function minutesBetween(startAt: Date, endAt: Date) {
  return Math.max(0, differenceInMinutes(endAt, startAt));
}

type OverrideSession = {
  id?: string | null;
  startAt: Date;
  endAt: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export function calculateEffectiveWorkedMinutes(params: {
  sessions: OverrideSession[];
  from?: Date;
  to?: Date;
}) {
  const intervals = params.sessions
    .filter((session) => Boolean(session.endAt))
    .map((session, index) => {
      const rawStart = session.startAt.getTime();
      const rawEnd = session.endAt!.getTime();
      const rangeStart = params.from ? params.from.getTime() : rawStart;
      const rangeEnd = params.to ? params.to.getTime() : rawEnd;
      const start = Math.max(rawStart, rangeStart);
      const end = Math.min(rawEnd, rangeEnd);
      const precedenceAt = (session.updatedAt ?? session.createdAt ?? session.startAt).getTime();

      return {
        index,
        id: session.id ?? String(index),
        start,
        end,
        precedenceAt
      };
    })
    .filter((item) => item.end > item.start)
    .sort((a, b) => {
      if (a.precedenceAt !== b.precedenceAt) return a.precedenceAt - b.precedenceAt;
      if (a.start !== b.start) return a.start - b.start;
      if (a.end !== b.end) return a.end - b.end;
      return String(a.id).localeCompare(String(b.id));
    })
    .map((item, order) => ({ ...item, order }));

  if (intervals.length === 0) {
    return { totalMinutes: 0, dailyMinutesByDate: {} as Record<string, number> };
  }

  const boundaries = new Set<number>();
  for (const interval of intervals) {
    boundaries.add(interval.start);
    boundaries.add(interval.end);
  }

  const minBoundary = Math.min(...intervals.map((item) => item.start));
  const maxBoundary = Math.max(...intervals.map((item) => item.end));
  let dayCursor = startOfDay(new Date(minBoundary)).getTime();
  while (dayCursor <= maxBoundary) {
    boundaries.add(dayCursor);
    dayCursor = addDays(new Date(dayCursor), 1).getTime();
  }

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  const dailyMinutesByDate: Record<string, number> = {};
  let totalMinutes = 0;

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const sliceStart = sorted[i];
    const sliceEnd = sorted[i + 1];
    if (sliceEnd <= sliceStart) continue;

    let winner: (typeof intervals)[number] | null = null;
    for (const interval of intervals) {
      if (interval.start < sliceEnd && interval.end > sliceStart) {
        if (!winner || interval.order > winner.order) {
          winner = interval;
        }
      }
    }

    if (!winner) continue;

    const sliceMinutes = minutesBetween(new Date(sliceStart), new Date(sliceEnd));
    if (sliceMinutes <= 0) continue;

    totalMinutes += sliceMinutes;
    const dayKey = format(new Date(sliceStart), "yyyy-MM-dd");
    dailyMinutesByDate[dayKey] = (dailyMinutesByDate[dayKey] ?? 0) + sliceMinutes;
  }

  return { totalMinutes, dailyMinutesByDate };
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
