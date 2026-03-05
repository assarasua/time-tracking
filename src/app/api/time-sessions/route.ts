import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import type { DbClient } from "@/lib/db";
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

    if (overlaps.length === 0) {
      const created = await tx.timeSession.create({
        data: {
          organizationUserId: authResult.membership.id,
          userId: authResult.session.user.id,
          startAt: payload.data.startAt,
          endAt: payload.data.endAt,
          editedById: authResult.session.user.id
        }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: authResult.session.user.id,
          entityType: "time_session",
          entityId: created.id,
          action: "created_manual",
          afterJson: {
            startAt: created.startAt.toISOString(),
            endAt: created.endAt?.toISOString()
          }
        }
      });

      return { status: 201 as const, session: created };
    }

    const [primary, ...duplicates] = overlaps.sort((a: any, b: any) => a.startAt.getTime() - b.startAt.getTime());
    const beforeJson = {
      id: primary.id,
      startAt: primary.startAt.toISOString(),
      endAt: primary.endAt?.toISOString() ?? null
    };

    const updated = await tx.timeSession.update({
      where: { id: primary.id },
      data: {
        startAt: payload.data.startAt,
        endAt: payload.data.endAt,
        editedById: authResult.session.user.id,
        editReason: "auto_overlap_update"
      }
    });

    const removedIds: string[] = [];
    for (const duplicate of duplicates) {
      await tx.timeSession.delete({ where: { id: duplicate.id } });
      removedIds.push(duplicate.id);
    }

    await tx.auditLog.create({
      data: {
        actorUserId: authResult.session.user.id,
        entityType: "time_session",
        entityId: updated.id,
        action: "updated_manual_overlap",
        beforeJson,
        afterJson: {
          startAt: updated.startAt.toISOString(),
          endAt: updated.endAt?.toISOString(),
          removedOverlappingSessionIds: removedIds
        }
      }
    });

    return { status: 200 as const, session: updated };
  });

  return NextResponse.json(
    {
      id: result.session.id,
      startAt: result.session.startAt,
      endAt: result.session.endAt,
      editReason: result.session.editReason
    },
    { status: result.status }
  );
}
