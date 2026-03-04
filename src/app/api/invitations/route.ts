import { randomBytes, createHash } from "node:crypto";
import { addDays } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { ensureAdmin, requireSession } from "@/lib/rbac";
import { invitationSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const adminError = ensureAdmin(authResult.membership.role);
  if (adminError) return adminError;

  const payload = invitationSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const invitation = await db.invitation.create({
    data: {
      organizationId: authResult.membership.organizationId,
      email: payload.data.email,
      role: payload.data.role,
      tokenHash,
      expiresAt: addDays(new Date(), 7)
    }
  });

  await writeAuditLog({
    actorUserId: authResult.session.user.id,
    entityType: "invitation",
    entityId: invitation.id,
    action: "created",
    afterJson: {
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString()
    }
  });

  await sendEmail({
    to: invitation.email,
    subject: "You are invited to Time Tracking",
    html: `<p>You were invited to Time Tracking. Sign in with Google using this email: ${invitation.email}</p><p>App URL: ${env.APP_BASE_URL}</p>`
  });

  return NextResponse.json({ id: invitation.id, email: invitation.email, role: invitation.role }, { status: 201 });
}
