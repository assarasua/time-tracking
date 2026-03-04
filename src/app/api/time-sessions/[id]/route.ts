import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { isWithinInterval } from "date-fns";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { getWeekRange } from "@/lib/time";
import { editSessionSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const { id } = await params;

  const payload = editSessionSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  if (payload.data.endAt <= payload.data.startAt) {
    return NextResponse.json({ error: "endAt must be after startAt" }, { status: 400 });
  }

  const existing = await db.timeSession.findUnique({
    where: { id },
    include: {
      organizationUser: {
        include: {
          organization: true
        }
      }
    }
  });

  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const isAdmin = authResult.membership.role === Role.admin;
  const isOwner = existing.organizationUserId === authResult.membership.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { weekStart, weekEnd } = getWeekRange(new Date(), existing.organizationUser.organization.weekStartDay);

  if (!isAdmin) {
    if (!isWithinInterval(payload.data.startAt, { start: weekStart, end: weekEnd })) {
      return NextResponse.json({ error: "Employees can only edit current week" }, { status: 403 });
    }
  }

  const lock = await db.weekLock.findUnique({
    where: {
      organizationId_weekStart: {
        organizationId: existing.organizationUser.organizationId,
        weekStart
      }
    }
  });

  if (lock && !isAdmin) {
    return NextResponse.json({ error: "Week is locked" }, { status: 423 });
  }

  const before = {
    startAt: existing.startAt.toISOString(),
    endAt: existing.endAt?.toISOString() ?? null,
    editReason: existing.editReason
  };

  const updated = await db.timeSession.update({
    where: { id },
    data: {
      startAt: payload.data.startAt,
      endAt: payload.data.endAt,
      editReason: payload.data.reason,
      editedById: authResult.session.user.id
    }
  });

  await writeAuditLog({
    actorUserId: authResult.session.user.id,
    entityType: "time_session",
    entityId: updated.id,
    action: "updated",
    beforeJson: before,
    afterJson: {
      startAt: updated.startAt.toISOString(),
      endAt: updated.endAt?.toISOString(),
      editReason: updated.editReason
    }
  });

  return NextResponse.json({ id: updated.id, startAt: updated.startAt, endAt: updated.endAt, editReason: updated.editReason });
}
