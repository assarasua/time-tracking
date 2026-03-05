import { formatISO } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getBusinessDaysInWeek, getWeekRange } from "@/lib/time";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await db.organizationUser.findMany({
    where: {
      active: true,
      user: { status: "active" }
    },
    include: {
      organization: true,
      user: true,
      timeSessions: {
        where: {
          startAt: {
            gte: getWeekRange(new Date(), 1).weekStart
          }
        }
      }
    }
  });

  let remindersSent = 0;

  for (const membership of memberships as any[]) {
    const hasOpenSession = membership.timeSessions.some((session: any) => session.endAt === null);

    const { weekStart } = getWeekRange(new Date(), membership.organization.weekStartDay);
    const businessDays = getBusinessDaysInWeek(weekStart);

    const loggedDays = new Set(
      membership.timeSessions.map((session: any) => formatISO(session.startAt, { representation: "date" }))
    );

    const missingDayCount = businessDays.filter((day) => {
      const key = formatISO(day, { representation: "date" });
      return !loggedDays.has(key);
    }).length;

    if (hasOpenSession || missingDayCount > 0) {
      await sendEmail({
        to: membership.user.email,
        subject: "Time tracking reminder",
        html: `<p>You have ${hasOpenSession ? "an active session that needs clock-out" : ""}${hasOpenSession && missingDayCount > 0 ? " and " : ""}${missingDayCount > 0 ? `${missingDayCount} missing day(s) this week` : ""}.</p>`
      });
      remindersSent += 1;
    }
  }

  return NextResponse.json({ ok: true, remindersSent });
}
