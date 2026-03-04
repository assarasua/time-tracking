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

  const existing = await db.weekLock.findUnique({
    where: {
      organizationId_weekStart: {
        organizationId: authResult.membership.organizationId,
        weekStart
      }
    }
  });

  if (!existing) {
    return NextResponse.json({ error: "Week is not locked" }, { status: 404 });
  }

  await db.weekLock.delete({ where: { id: existing.id } });

  await writeAuditLog({
    actorUserId: authResult.session.user.id,
    entityType: "week_lock",
    entityId: existing.id,
    action: "unlocked",
    beforeJson: { weekStart: existing.weekStart.toISOString(), lockedAt: existing.lockedAt.toISOString() }
  });

  return NextResponse.json({ ok: true });
}
