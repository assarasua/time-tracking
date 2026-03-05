import { addDays, formatISO, startOfDay } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/perf-cache";
import { requireSession } from "@/lib/rbac";
import { getWeekRange, minutesBetween, weekStartFromParam } from "@/lib/time";
import { weekQuerySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const query = weekQuerySchema.safeParse({
    week_start: request.nextUrl.searchParams.get("week_start") ?? formatISO(new Date(), { representation: "date" })
  });

  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  const weekStart = weekStartFromParam(query.data.week_start, authResult.membership.organization.weekStartDay);
  const { weekEnd } = getWeekRange(weekStart, authResult.membership.organization.weekStartDay);

  const sessions = await db.timeSession.findMany({
    where: {
      organizationUserId: authResult.membership.id,
      startAt: {
        gte: weekStart,
        lte: weekEnd
      }
    },
    orderBy: {
      startAt: "asc"
    }
  });

  const workedMinutes = (sessions as any[]).reduce((total: number, item: any) => {
    if (!item.endAt) return total;
    return total + minutesBetween(item.startAt, item.endAt);
  }, 0);

  const expectedMinutes = authResult.membership.weeklyTargetMinute;
  const weekLock = await db.weekLock.findUnique({
    where: {
      organizationId_weekStart: {
        organizationId: authResult.membership.organizationId,
        weekStart
      }
    }
  });

  const daily = Array.from({ length: 7 }, (_, index) => {
    const dayDate = startOfDay(addDays(weekStart, index));
    const nextDay = addDays(dayDate, 1);
    const daySessions = (sessions as any[]).filter((session: any) =>
      session.startAt >= dayDate && session.startAt < nextDay
    );
    const dayWorkedMinutes = daySessions.reduce((total: number, session: any) => {
      if (!session.endAt) return total;
      return total + minutesBetween(session.startAt, session.endAt);
    }, 0);

    return {
      date: formatISO(dayDate, { representation: "date" }),
      workedMinutes: dayWorkedMinutes,
      sessions: daySessions
    };
  });

  return withSummaryCache(NextResponse.json({
    weekStart,
    weekEnd,
    workedMinutes,
    expectedMinutes,
    varianceMinutes: workedMinutes - expectedMinutes,
    sessions,
    weekLocked: Boolean(weekLock),
    daily
  }));
}
