import { subWeeks } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getWeekRange } from "@/lib/time";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await db.organization.findMany();

  let created = 0;
  for (const org of orgs) {
    const previousWeekDate = subWeeks(new Date(), 1);
    const { weekStart } = getWeekRange(previousWeekDate, org.weekStartDay);

    await db.weekLock.upsert({
      where: {
        organizationId_weekStart: {
          organizationId: org.id,
          weekStart
        }
      },
      update: {},
      create: {
        organizationId: org.id,
        weekStart,
        autoLocked: true
      }
    });
    created += 1;
  }

  return NextResponse.json({ ok: true, organizationsProcessed: created });
}
