import { NextRequest, NextResponse } from "next/server";
import { addDays, endOfDay, startOfDay } from "date-fns";

import { db } from "@/lib/db";
import type { DbClient } from "@/lib/db";
import { Role } from "@/lib/db/schema";
import { publishTimeSessionChanged } from "@/lib/realtime";
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
  const dayStart = startOfDay(payload.data.startAt);
  const todayStart = startOfDay(new Date());

  if (dayStart > todayStart) {
    return NextResponse.json({ error: "Add hours is not allowed for future dates" }, { status: 403 });
  }

  const addDeadline = addDays(endOfDay(payload.data.startAt), 7);

  if (new Date() > addDeadline) {
    return NextResponse.json({ error: "Add hours is only allowed up to 7 days after that day" }, { status: 403 });
  }

  if (!isAdmin) {
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

  const result = await db.$transaction(async (tx: DbClient) => {
    const candidates = await tx.timeSession.findMany({
      where: {
        organizationUserId: authResult.membership.id,
        startAt: {
          lte: payload.data.endAt
        }
      },
      orderBy: {
        startAt: "asc"
      }
    });

    const overlaps = candidates.filter(
      (sessionItem: any) =>
        sessionItem.startAt < payload.data.endAt &&
        (sessionItem.endAt === null || sessionItem.endAt > payload.data.startAt)
    );

    const created = await tx.timeSession.create({
      data: {
        organizationUserId: authResult.membership.id,
        userId: authResult.session.user.id,
        startAt: payload.data.startAt,
        endAt: payload.data.endAt,
        editedById: authResult.session.user.id,
        editReason: overlaps.length > 0 ? "manual_override" : null
      }
    });

    const removedIds: string[] = [];
    if (overlaps.length > 0) {
      for (const sessionItem of overlaps) {
        await tx.timeSession.delete({ where: { id: sessionItem.id } });
        removedIds.push(sessionItem.id);
      }
    }

    await tx.auditLog.create({
      data: {
        actorUserId: authResult.session.user.id,
        entityType: "time_session",
        entityId: created.id,
        action: overlaps.length > 0 ? "created_manual_override" : "created_manual",
        afterJson: {
          startAt: created.startAt.toISOString(),
          endAt: created.endAt?.toISOString(),
          overriddenSessionIds: removedIds
        }
      }
    });

    return {
      status: overlaps.length > 0 ? (200 as const) : (201 as const),
      session: created,
      overriddenSessionIds: removedIds
    };
  });

  publishTimeSessionChanged({
    userId: authResult.session.user.id,
    organizationId: authResult.membership.organizationId,
    membershipId: authResult.membership.id
  });

  return NextResponse.json(
    {
      id: result.session.id,
      startAt: result.session.startAt,
      endAt: result.session.endAt,
      editReason: result.session.editReason,
      overriddenSessionIds: result.overriddenSessionIds
    },
    { status: result.status }
  );
}
