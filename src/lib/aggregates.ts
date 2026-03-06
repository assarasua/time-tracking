import { eachDayOfInterval, eachMonthOfInterval, format, parseISO } from "date-fns";

import { db } from "@/lib/db";
import { calculateEffectiveWorkedMinutes } from "@/lib/time";

export function normalizeRange(from: string, to: string) {
  const fromDate = parseISO(`${from}T00:00:00.000Z`);
  const toDateRaw = parseISO(`${to}T23:59:59.999Z`);
  const toDate = toDateRaw < fromDate ? new Date(fromDate.getTime() + (23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000 + 999)) : toDateRaw;

  return {
    fromDate,
    toDate,
    fromKey: format(fromDate, "yyyy-MM-dd"),
    toKey: format(toDate, "yyyy-MM-dd")
  };
}

function businessDaysCount(fromDate: Date, toDate: Date) {
  return eachDayOfInterval({ start: fromDate, end: toDate }).filter((day) => {
    const dow = day.getUTCDay();
    return dow >= 1 && dow <= 5;
  }).length;
}

export async function getMeRangeSummaryData(params: {
  membershipId: string;
  weeklyTargetMinute: number;
  from: string;
  to: string;
}) {
  const range = normalizeRange(params.from, params.to);
  const sessions = await db.timeSession.findMany({
    where: {
      organizationUserId: params.membershipId,
      startAt: {
        gte: range.fromDate,
        lte: range.toDate
      },
      endAt: {
        not: null
      }
    },
    orderBy: {
      startAt: "asc"
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const effectiveWorked = calculateEffectiveWorkedMinutes({
    sessions: sessions as any[],
    from: range.fromDate,
    to: range.toDate
  });
  const workedMinutes = effectiveWorked.totalMinutes;

  const expectedPerBusinessDay = Math.round(params.weeklyTargetMinute / 5);
  const expectedMinutes = expectedPerBusinessDay * businessDaysCount(range.fromDate, range.toDate);

  const daily = eachDayOfInterval({ start: range.fromDate, end: range.toDate }).map((day) => {
    const dayKey = format(day, "yyyy-MM-dd");
    const dayWorkedMinutes = effectiveWorked.dailyMinutesByDate[dayKey] ?? 0;

    return {
      date: dayKey,
      workedMinutes: dayWorkedMinutes
    };
  });

  const monthly = eachMonthOfInterval({ start: range.fromDate, end: range.toDate }).map((monthDate) => {
    const monthKey = format(monthDate, "yyyy-MM");
    const monthStart = parseISO(`${monthKey}-01T00:00:00.000Z`);
    const monthEnd = new Date(new Date(monthStart).setUTCMonth(monthStart.getUTCMonth() + 1, 0));
    monthEnd.setUTCHours(23, 59, 59, 999);
    const effectiveStart = monthStart > range.fromDate ? monthStart : range.fromDate;
    const effectiveEnd = monthEnd < range.toDate ? monthEnd : range.toDate;
    const worked = calculateEffectiveWorkedMinutes({
      sessions: sessions as any[],
      from: effectiveStart,
      to: effectiveEnd
    }).totalMinutes;

    return {
      month: monthKey,
      workedMinutes: worked
    };
  });

  return {
    from: range.fromKey,
    to: range.toKey,
    workedMinutes,
    expectedMinutes,
    varianceMinutes: workedMinutes - expectedMinutes,
    daily,
    monthly
  };
}

export async function getAdminRangeOverviewData(params: {
  organizationId: string;
  from: string;
  to: string;
}) {
  const range = normalizeRange(params.from, params.to);

  const [members, sessions] = await Promise.all([
    db.organizationUser.findMany({
      where: {
        organizationId: params.organizationId
      },
      include: {
        user: true
      },
      orderBy: {
        createdAt: "asc"
      }
    }),
    db.timeSession.findMany({
      where: {
        organizationUser: {
          organizationId: params.organizationId
        },
        startAt: {
          gte: range.fromDate,
          lte: range.toDate
        },
        endAt: {
          not: null
        }
      },
      select: {
        organizationUserId: true,
        startAt: true,
        endAt: true,
        createdAt: true,
        updatedAt: true,
        id: true
      }
    })
  ]);

  const rangeDays = eachDayOfInterval({ start: range.fromDate, end: range.toDate }).map((day) => format(day, "yyyy-MM-dd"));

  const membersData = (members as any[]).map((member: any) => {
    const memberSessions = (sessions as any[]).filter((session: any) => session.organizationUserId === member.id);
    const effectiveWorked = calculateEffectiveWorkedMinutes({
      sessions: memberSessions,
      from: range.fromDate,
      to: range.toDate
    });
    const dailyMinutes = rangeDays.map((dayKey) => effectiveWorked.dailyMinutesByDate[dayKey] ?? 0);

    return {
      membershipId: member.id,
      userName: member.user.name ?? member.user.email,
      userEmail: member.user.email,
      role: member.role,
      dailyMinutes,
      rangeMinutes: effectiveWorked.totalMinutes
    };
  });

  return {
    from: range.fromKey,
    to: range.toKey,
    days: rangeDays,
    members: membersData
  };
}
