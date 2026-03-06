import { endOfMonth, format, startOfMonth } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/perf-cache";
import { requireSession } from "@/lib/rbac";
import { calculateEffectiveWorkedMinutes } from "@/lib/time";
import { monthQuerySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const fallbackMonth = format(new Date(), "yyyy-MM");
  const query = monthQuerySchema.safeParse({
    month: request.nextUrl.searchParams.get("month") ?? fallbackMonth
  });

  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  const monthStart = startOfMonth(new Date(`${query.data.month}-01T00:00:00.000Z`));
  const monthEnd = endOfMonth(monthStart);

  const sessions = await db.timeSession.findMany({
    where: {
      organizationUserId: authResult.membership.id,
      startAt: {
        gte: monthStart,
        lte: monthEnd
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

  const workedMinutes = calculateEffectiveWorkedMinutes({
    sessions: sessions as any[],
    from: monthStart,
    to: monthEnd
  }).totalMinutes;

  return withSummaryCache(NextResponse.json({
    month: query.data.month,
    monthStart,
    monthEnd,
    workedMinutes
  }));
}
