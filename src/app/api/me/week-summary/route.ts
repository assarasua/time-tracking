import { formatISO } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
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

  const workedMinutes = sessions.reduce((total, item) => {
    if (!item.endAt) return total;
    return total + minutesBetween(item.startAt, item.endAt);
  }, 0);

  const expectedMinutes = authResult.membership.weeklyTargetMinute;

  return NextResponse.json({
    weekStart,
    weekEnd,
    workedMinutes,
    expectedMinutes,
    varianceMinutes: workedMinutes - expectedMinutes,
    sessions
  });
}
