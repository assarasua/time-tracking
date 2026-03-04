import { NextRequest, NextResponse } from "next/server";

import { authFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await authFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
    organizationId: session.user.organizationId,
    expiresAt: session.expiresAt
  });
}
