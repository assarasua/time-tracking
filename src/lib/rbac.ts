import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const membership = await db.organizationUser.findFirst({
    where: {
      userId: session.user.id,
      organizationId: session.user.organizationId,
      active: true
    },
    include: {
      organization: true,
      user: true
    }
  });

  if (!membership) {
    return { error: NextResponse.json({ error: "Membership not found" }, { status: 403 }) };
  }

  return { session, membership };
}

export function ensureAdmin(role: Role) {
  if (role !== Role.admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  return null;
}
