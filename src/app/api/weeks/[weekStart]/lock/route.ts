import { NextRequest, NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { ensureAdmin, requireSession } from "@/lib/rbac";
import { weekStartFromParam } from "@/lib/time";

export async function POST(_: NextRequest, { params }: { params: Promise<{ weekStart: string }> }) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const adminError = ensureAdmin(authResult.membership.role);
  if (adminError) return adminError;

  const { weekStart: weekStartParam } = await params;

  let weekStart: Date;
  try {
    weekStart = weekStartFromParam(weekStartParam, authResult.membership.organization.weekStartDay);
  } catch {
    return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });
  }

  const weekLock = await db.weekLock.upsert({
    where: {
      organizationId_weekStart: {
        organizationId: authResult.membership.organizationId,
        weekStart
      }
    },
    update: {
      lockedAt: new Date(),
      autoLocked: false,
      lockedByUserId: authResult.session.user.id
    },
    create: {
      organizationId: authResult.membership.organizationId,
      weekStart,
      autoLocked: false,
      lockedByUserId: authResult.session.user.id
    }
  });

  await writeAuditLog({
    actorUserId: authResult.session.user.id,
    entityType: "week_lock",
    entityId: weekLock.id,
    action: "locked",
    afterJson: { weekStart: weekLock.weekStart.toISOString(), autoLocked: false }
  });

  return NextResponse.json({ id: weekLock.id, weekStart: weekLock.weekStart, lockedAt: weekLock.lockedAt });
}
