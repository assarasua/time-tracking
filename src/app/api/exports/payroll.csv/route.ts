import { NextRequest, NextResponse } from "next/server";
import { eachDayOfInterval, eachMonthOfInterval, format, startOfMonth, endOfMonth } from "date-fns";

import { buildPayrollCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { Role } from "@/lib/db/schema";
import { requireSession } from "@/lib/rbac";
import { calculateEffectiveWorkedMinutes } from "@/lib/time";
import { exportQuerySchema } from "@/lib/validation";

function sanitizeFilePart(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  if (authResult.membership.role !== Role.admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const query = exportQuerySchema.safeParse({
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
    membership_id: request.nextUrl.searchParams.get("membership_id") ?? undefined
  });

  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  const from = new Date(`${query.data.from}T00:00:00.000Z`);
  const toRaw = new Date(`${query.data.to}T23:59:59.999Z`);
  const to = toRaw < from ? from : toRaw;
  const membershipId = query.data.membership_id;

  const memberships = await db.organizationUser.findMany({
    where: {
      organizationId: authResult.membership.organizationId,
      active: true,
      ...(membershipId ? { id: membershipId } : {})
    },
    include: {
      user: true,
      timeSessions: {
        where: {
          startAt: {
            gte: from,
            lte: to
          }
        }
      }
    }
  });

  if (membershipId && memberships.length === 0) {
    return NextResponse.json({ error: "Membership not found in this organization" }, { status: 404 });
  }

  const months = eachMonthOfInterval({ start: from, end: to });

  const rows = memberships.flatMap((membership: any) =>
    months.map((monthStartDate) => {
      const monthStart = startOfMonth(monthStartDate);
      const monthEnd = endOfMonth(monthStartDate);
      const effectiveStart = monthStart > from ? monthStart : from;
      const effectiveEnd = monthEnd < to ? monthEnd : to;

      const monthSessions = membership.timeSessions.filter(
        (session: any) =>
          session.startAt >= effectiveStart &&
          session.startAt <= effectiveEnd &&
          session.endAt !== null
      );

      const workedMinutes = calculateEffectiveWorkedMinutes({
        sessions: monthSessions as any[],
        from: effectiveStart,
        to: effectiveEnd
      }).totalMinutes;
      const businessDays = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd }).filter((day) => {
        const dow = day.getUTCDay();
        return dow >= 1 && dow <= 5;
      }).length;
      const expectedPerBusinessDay = Math.round(membership.weeklyTargetMinute / 5);
      const expectedMinutes = expectedPerBusinessDay * businessDays;

      return {
        email: membership.user.email,
        name: membership.user.name ?? "",
        month: format(monthStart, "yyyy-MM"),
        workedMinutes,
        expectedMinutes,
        varianceMinutes: workedMinutes - expectedMinutes
      };
    })
  );

  const csv = buildPayrollCsv(rows);
  const rangePart = `${query.data.from}-to-${query.data.to}`;
  const filename = membershipId
    ? `${sanitizeFilePart(memberships[0]?.user?.name || memberships[0]?.user?.email || "employee")}-${rangePart}.csv`
    : `hutech-${rangePart}-monthly.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`
    }
  });
}
