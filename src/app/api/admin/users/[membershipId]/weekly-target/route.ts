import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { ensureAdmin, requireSession } from "@/lib/rbac";

const bodySchema = z.object({
  weeklyTargetMinute: z.number().int().min(60).max(10080)
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ membershipId: string }> }) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const adminError = ensureAdmin(authResult.membership.role);
  if (adminError) return adminError;

  const payload = bodySchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const { membershipId } = await params;

  const existing = await db.organizationUser.findUnique({ where: { id: membershipId } });
  if (!existing || existing.organizationId !== authResult.membership.organizationId) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  const updated = await db.organizationUser.update({
    where: { id: membershipId },
    data: {
      weeklyTargetMinute: payload.data.weeklyTargetMinute
    }
  });

  await writeAuditLog({
    actorUserId: authResult.session.user.id,
    entityType: "organization_user",
    entityId: updated.id,
    action: "weekly_target_updated",
    beforeJson: { weeklyTargetMinute: existing.weeklyTargetMinute },
    afterJson: { weeklyTargetMinute: updated.weeklyTargetMinute }
  });

  return NextResponse.json({ id: updated.id, weeklyTargetMinute: updated.weeklyTargetMinute });
}
