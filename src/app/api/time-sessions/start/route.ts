import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { publishTimeSessionChanged } from "@/lib/realtime";
import { requireSession } from "@/lib/rbac";

export async function POST() {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const activeSession = await db.timeSession.findFirst({
    where: {
      organizationUserId: authResult.membership.id,
      endAt: null
    }
  });

  if (activeSession) {
    return NextResponse.json({ error: "There is already an active session" }, { status: 409 });
  }

  const session = await db.timeSession.create({
    data: {
      organizationUserId: authResult.membership.id,
      userId: authResult.session.user.id,
      startAt: new Date()
    }
  });

  publishTimeSessionChanged({
    userId: authResult.session.user.id,
    organizationId: authResult.membership.organizationId,
    membershipId: authResult.membership.id
  });

  return NextResponse.json({ id: session.id, startAt: session.startAt }, { status: 201 });
}
