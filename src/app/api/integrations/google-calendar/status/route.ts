import { NextResponse } from "next/server";

import { getGoogleCalendarStatus } from "@/lib/google-calendar";
import { requireSession } from "@/lib/rbac";

export async function GET() {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const status = await getGoogleCalendarStatus(authResult.session.user.id);
  return NextResponse.json(status);
}
