import { endOfMonth, format, startOfMonth } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { minutesBetween } from "@/lib/time";
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
    }
  });

  const workedMinutes = (sessions as any[]).reduce((total: number, session: any) => {
    if (!session.endAt) return total;
    return total + minutesBetween(session.startAt, session.endAt);
  }, 0);

  return NextResponse.json({
    month: query.data.month,
    monthStart,
    monthEnd,
    workedMinutes
  });
}
