import { NextResponse } from "next/server";

import { getGoogleCalendarStatus, syncCaliforniaPublicHolidaysToGoogleCalendar } from "@/lib/google-calendar";
import { requireSession } from "@/lib/rbac";

export async function POST() {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const currentYear = new Date().getFullYear();
  const results = await syncCaliforniaPublicHolidaysToGoogleCalendar({
    userId: authResult.session.user.id,
    from: `${currentYear}-01-01`,
    to: `${currentYear}-12-31`
  });
  const status = await getGoogleCalendarStatus(authResult.session.user.id);

  return NextResponse.json({
    ok: true,
    googleCalendar: status,
    results
  });
}
