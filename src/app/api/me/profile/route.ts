import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/rbac";
import {
  ensureUserPreferenceTable,
  getUserTimezonePreference,
  setUserTimezonePreference
} from "@/lib/user-preferences";

const updateProfileSchema = z.object({
  timezone: z.string().min(3).max(100).regex(/^[A-Za-z_./+-]+$/, "Invalid timezone format")
});

export async function GET() {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  await ensureUserPreferenceTable();

  const preferredTimezone = await getUserTimezonePreference(authResult.session.user.id);
  const fallbackTimezone = authResult.membership.organization.timezone;

  return NextResponse.json({
    timezone: preferredTimezone ?? fallbackTimezone,
    preferredTimezone,
    organizationTimezone: fallbackTimezone
  });
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const payload = updateProfileSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  await ensureUserPreferenceTable();
  await setUserTimezonePreference(authResult.session.user.id, payload.data.timezone);

  return NextResponse.json({ ok: true, timezone: payload.data.timezone });
}
