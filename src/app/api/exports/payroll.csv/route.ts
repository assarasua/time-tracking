import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { eachWeekOfInterval, formatISO, startOfWeek } from "date-fns";

import { buildPayrollCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { minutesBetween } from "@/lib/time";
import { exportQuerySchema } from "@/lib/validation";

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
  const to = new Date(`${query.data.to}T23:59:59.999Z`);
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

  const weekStarts = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });

  const rows = memberships.flatMap((membership) =>
    weekStarts.map((weekStart) => {
      const currentWeekStart = startOfWeek(weekStart, { weekStartsOn: 1 });
      const nextWeekStart = new Date(currentWeekStart);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);

      const weekSessions = membership.timeSessions.filter(
        (session) =>
          session.startAt >= currentWeekStart &&
          session.startAt < nextWeekStart &&
          session.endAt !== null
      );

      const workedMinutes = weekSessions.reduce((total, session) => total + minutesBetween(session.startAt, session.endAt!), 0);

      return {
        email: membership.user.email,
        name: membership.user.name ?? "",
        weekStart: formatISO(currentWeekStart, { representation: "date" }),
        workedMinutes,
        expectedMinutes: membership.weeklyTargetMinute,
        varianceMinutes: workedMinutes - membership.weeklyTargetMinute
      };
    })
  );

  const csv = buildPayrollCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${membershipId ? `payroll-${membershipId}` : "payroll"}.csv`
    }
  });
}
