import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireSession } from "@/lib/rbac";

export async function GET() {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const activeSession = await db.timeSession.findFirst({
    where: {
      organizationUserId: authResult.membership.id,
      endAt: null
    },
    orderBy: {
      startAt: "desc"
    }
  });

  if (!activeSession) {
    return NextResponse.json({ active: false, session: null });
  }

  return NextResponse.json({
    active: true,
    session: {
      id: activeSession.id,
      startAt: activeSession.startAt
    }
  });
}
