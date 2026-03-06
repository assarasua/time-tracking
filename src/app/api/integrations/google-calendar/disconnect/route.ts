import { NextResponse } from "next/server";

import { disconnectGoogleCalendar } from "@/lib/google-calendar";
import { requireSession } from "@/lib/rbac";

export async function POST() {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  await disconnectGoogleCalendar(authResult.session.user.id);
  return NextResponse.json({ ok: true });
}
