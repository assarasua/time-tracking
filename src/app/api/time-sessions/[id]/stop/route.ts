import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireSession } from "@/lib/rbac";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const { id } = await params;

  const session = await db.timeSession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.organizationUserId !== authResult.membership.id) {
    return NextResponse.json({ error: "Cannot stop another user's session" }, { status: 403 });
  }

  if (session.endAt) {
    return NextResponse.json({ error: "Session already stopped" }, { status: 409 });
  }

  const updated = await db.timeSession.update({
    where: { id },
    data: { endAt: new Date() }
  });

  return NextResponse.json({ id: updated.id, startAt: updated.startAt, endAt: updated.endAt });
}
