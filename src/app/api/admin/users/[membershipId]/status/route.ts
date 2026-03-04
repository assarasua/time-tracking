import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { ensureAdmin, requireSession } from "@/lib/rbac";

const bodySchema = z.object({
  active: z.boolean()
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
      active: payload.data.active
    }
  });

  await writeAuditLog({
    actorUserId: authResult.session.user.id,
    entityType: "organization_user",
    entityId: updated.id,
    action: "membership_status_updated",
    beforeJson: { active: existing.active },
    afterJson: { active: updated.active }
  });

  return NextResponse.json({ id: updated.id, active: updated.active });
}
