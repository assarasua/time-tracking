import { addDays, formatISO, startOfWeek } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

import { getAdminRangeOverviewData } from "@/lib/aggregates";
import { withSummaryCache } from "@/lib/perf-cache";
import { Role } from "@/lib/db/schema";
import { requireSession } from "@/lib/rbac";
import { rangeQuerySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  if (authResult.membership.role !== Role.admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

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
  const result = await getAdminRangeOverviewData({
    organizationId: authResult.membership.organizationId,
    from: query.data.from,
    to: query.data.to
  });
  const dbElapsed = Math.round(performance.now() - dbStartedAt);
  const totalElapsed = Math.round(performance.now() - startedAt);
  console.info("[perf] /api/admin/range-overview", {
    orgId: authResult.membership.organizationId,
    from: result.from,
    to: result.to,
    memberCount: result.members.length,
    dbMs: dbElapsed,
    totalMs: totalElapsed
  });

  return withSummaryCache(NextResponse.json(result));
}
