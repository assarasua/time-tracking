import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";

import { requireSession } from "@/lib/rbac";
import { getMembershipTimeOffEntries, upsertMembershipTimeOffEntries } from "@/lib/time-off";
import { getCaliforniaPublicHolidaysByDate } from "@/lib/california-holidays";
import { createTimeOffSchema, timeOffQuerySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const query = timeOffQuerySchema.safeParse({
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to")
  });

  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  const entries = await getMembershipTimeOffEntries({
    organizationUserId: authResult.membership.id,
    from: query.data.from,
    to: query.data.to
  });

  return NextResponse.json({
    from: query.data.from,
    to: query.data.to,
    entries
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const payload = createTimeOffSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const pastEntries = payload.data.entries.filter((entry) => entry.date < today);

  if (pastEntries.length > 0) {
    return NextResponse.json({ error: "Time off cannot be added for past days." }, { status: 403 });
  }

  const blockedDates = new Set(
    payload.data.entries
      .filter((entry) => {
        const day = new Date(`${entry.date}T12:00:00`);
        const dayOfWeek = day.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6;
      })
      .map((entry) => entry.date)
  );

  const holidayLookup = getCaliforniaPublicHolidaysByDate(today, format(new Date(`${today}T12:00:00`).getFullYear() + 1 + "-12-31", "yyyy-MM-dd"));
  for (const entry of payload.data.entries) {
    if (holidayLookup.has(entry.date)) {
      blockedDates.add(entry.date);
    }
  }

  if (blockedDates.size > 0) {
    return NextResponse.json({ error: "Weekends and public holidays cannot be selected as time off." }, { status: 403 });
  }

  const entries = await upsertMembershipTimeOffEntries({
    organizationId: authResult.membership.organizationId,
    organizationUserId: authResult.membership.id,
    entries: [...new Map(payload.data.entries.map((entry) => [entry.date, entry])).values()].sort((a, b) =>
      a.date.localeCompare(b.date)
    )
  });

  return NextResponse.json({
    ok: true,
    entries
  });
}
