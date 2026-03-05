import { addDays, formatISO, startOfWeek } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

import { getMeRangeSummaryData } from "@/lib/aggregates";
import { withSummaryCache } from "@/lib/perf-cache";
import { requireSession } from "@/lib/rbac";
import { rangeQuerySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const fallbackStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const fallback = {
    from: formatISO(fallbackStart, { representation: "date" }),
    to: formatISO(addDays(fallbackStart, 6), { representation: "date" })
  };

  const query = rangeQuerySchema.safeParse({
    from: request.nextUrl.searchParams.get("from") ?? fallback.from,
    to: request.nextUrl.searchParams.get("to") ?? fallback.to
  });

  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  const dbStartedAt = performance.now();
  const summary = await getMeRangeSummaryData({
    membershipId: authResult.membership.id,
    weeklyTargetMinute: authResult.membership.weeklyTargetMinute,
    from: query.data.from,
    to: query.data.to
  });
  const dbElapsed = Math.round(performance.now() - dbStartedAt);
  const totalElapsed = Math.round(performance.now() - startedAt);
  console.info("[perf] /api/me/range-summary", {
    userId: authResult.session.user.id,
    from: summary.from,
    to: summary.to,
    dbMs: dbElapsed,
    totalMs: totalElapsed
  });

  return withSummaryCache(NextResponse.json(summary));
}
