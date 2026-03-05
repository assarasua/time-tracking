import { NextRequest, NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { Role } from "@/lib/db/schema";
import { requireSession } from "@/lib/rbac";
import { getWeekRange } from "@/lib/time";
import { createSessionSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const payload = createSessionSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  if (payload.data.endAt <= payload.data.startAt) {
    return NextResponse.json({ error: "endAt must be after startAt" }, { status: 400 });
  }

  const isAdmin = authResult.membership.role === Role.admin;
  const organizationWeekStartDay = authResult.membership.organization.weekStartDay;
  const targetWeek = getWeekRange(payload.data.startAt, organizationWeekStartDay);
  const currentWeek = getWeekRange(new Date(), organizationWeekStartDay);

  if (!isAdmin) {
    const isCurrentWeek = targetWeek.weekStart.getTime() === currentWeek.weekStart.getTime();
    if (!isCurrentWeek || payload.data.endAt > targetWeek.weekEnd) {
      return NextResponse.json({ error: "Employees can only add entries in current week" }, { status: 403 });
    }

    const lock = await db.weekLock.findUnique({
      where: {
        organizationId_weekStart: {
          organizationId: authResult.membership.organizationId,
          weekStart: targetWeek.weekStart
        }
      }
    });

    if (lock) {
      return NextResponse.json({ error: "Week is locked" }, { status: 423 });
    }
  }

  const overlap = await db.timeSession.findFirst({
    where: {
      organizationUserId: authResult.membership.id,
      startAt: {
        lt: payload.data.endAt
      },
      OR: [{ endAt: null }, { endAt: { gt: payload.data.startAt } }]
    },
    select: {
      id: true
    }
  });

  if (overlap) {
    return NextResponse.json({ error: "Session overlaps existing entry" }, { status: 409 });
  }

  const created = await db.timeSession.create({
    data: {
      organizationUserId: authResult.membership.id,
      userId: authResult.session.user.id,
      startAt: payload.data.startAt,
      endAt: payload.data.endAt,
      editedById: authResult.session.user.id
    }
  });

  await writeAuditLog({
    actorUserId: authResult.session.user.id,
    entityType: "time_session",
    entityId: created.id,
    action: "created_manual",
    afterJson: {
      startAt: created.startAt.toISOString(),
      endAt: created.endAt?.toISOString()
    }
  });

  return NextResponse.json(
    {
      id: created.id,
      startAt: created.startAt,
      endAt: created.endAt,
      editReason: created.editReason
    },
    { status: 201 }
  );
}
