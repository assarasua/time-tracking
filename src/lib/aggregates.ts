import { eachDayOfInterval, eachMonthOfInterval, format, parseISO } from "date-fns";

import { db } from "@/lib/db";
import { minutesBetween } from "@/lib/time";

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
      startAt: true,
      endAt: true
    }
  });

  const workedMinutes = (sessions as any[]).reduce((total: number, session: any) => {
    if (!session.endAt) return total;
    return total + minutesBetween(session.startAt, session.endAt);
  }, 0);

  const expectedPerBusinessDay = Math.round(params.weeklyTargetMinute / 5);
  const expectedMinutes = expectedPerBusinessDay * businessDaysCount(range.fromDate, range.toDate);

  const daily = eachDayOfInterval({ start: range.fromDate, end: range.toDate }).map((day) => {
    const dayKey = format(day, "yyyy-MM-dd");
    const dayWorkedMinutes = (sessions as any[]).reduce((total: number, session: any) => {
      if (!session.endAt) return total;
      return format(session.startAt, "yyyy-MM-dd") === dayKey
        ? total + minutesBetween(session.startAt, session.endAt)
        : total;
    }, 0);

    return {
      date: dayKey,
      workedMinutes: dayWorkedMinutes
    };
  });

  const monthly = eachMonthOfInterval({ start: range.fromDate, end: range.toDate }).map((monthDate) => {
    const monthKey = format(monthDate, "yyyy-MM");
    const worked = (sessions as any[]).reduce((total: number, session: any) => {
      if (!session.endAt) return total;
      return format(session.startAt, "yyyy-MM") === monthKey
        ? total + minutesBetween(session.startAt, session.endAt)
        : total;
    }, 0);

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
        endAt: true
      }
    })
  ]);

  const rangeDays = eachDayOfInterval({ start: range.fromDate, end: range.toDate }).map((day) => format(day, "yyyy-MM-dd"));

  const membersData = (members as any[]).map((member: any) => {
    const memberSessions = (sessions as any[]).filter((session: any) => session.organizationUserId === member.id);
    const dailyMinutes = rangeDays.map((dayKey) =>
      memberSessions.reduce((total: number, session: any) => {
        if (!session.endAt) return total;
        return format(session.startAt, "yyyy-MM-dd") === dayKey
          ? total + minutesBetween(session.startAt, session.endAt)
          : total;
      }, 0)
    );

    return {
      membershipId: member.id,
      userName: member.user.name ?? member.user.email,
      userEmail: member.user.email,
      role: member.role,
      dailyMinutes,
      rangeMinutes: dailyMinutes.reduce((sum, minutes) => sum + minutes, 0)
    };
  });

  return {
    from: range.fromKey,
    to: range.toKey,
    days: rangeDays,
    members: membersData
  };
}
