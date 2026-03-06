import { endOfYear, format } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

import { getCaliforniaPublicHolidaysByDate } from "@/lib/california-holidays";
import { getGoogleCalendarStatus, syncTimeOffEntryToGoogleCalendar } from "@/lib/google-calendar";
import { requireSession } from "@/lib/rbac";
import { deleteMembershipTimeOffEntry, getMembershipTimeOffEntries, upsertMembershipTimeOffEntries } from "@/lib/time-off";
import { createTimeOffSchema, timeOffQuerySchema } from "@/lib/validation";
import { deleteTimeOffEntryFromGoogleCalendar } from "@/lib/google-calendar";

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
  const holidayLookup = getCaliforniaPublicHolidaysByDate(today, format(endOfYear(new Date()), "yyyy-MM-dd"));
  const blockedDates = new Set<string>();

  for (const entry of payload.data.entries) {
    if (entry.date < today) {
      blockedDates.add(entry.date);
      continue;
    }

    const day = new Date(`${entry.date}T12:00:00`);
    const dayOfWeek = day.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6 || holidayLookup.has(entry.date)) {
      blockedDates.add(entry.date);
    }
  }

  if (blockedDates.size > 0) {
    return NextResponse.json({ error: "Weekends, public holidays, and past days cannot be selected as time off." }, { status: 403 });
  }

  const selectedFrom =
    payload.data.from ??
    payload.data.entries.reduce((min, entry) => (entry.date < min ? entry.date : min), payload.data.entries[0]?.date ?? today);
  const selectedTo =
    payload.data.to ??
    payload.data.entries.reduce((max, entry) => (entry.date > max ? entry.date : max), payload.data.entries[0]?.date ?? today);

  const existingEntries = await getMembershipTimeOffEntries({
    organizationUserId: authResult.membership.id,
    from: selectedFrom,
    to: selectedTo
  });
  const desiredByDate = new Map(payload.data.entries.map((entry) => [entry.date, entry]));
  const removals = existingEntries.filter((entry) => !desiredByDate.has(entry.date));

  const entries = await upsertMembershipTimeOffEntries({
    organizationId: authResult.membership.organizationId,
    organizationUserId: authResult.membership.id,
    entries: [...new Map(payload.data.entries.map((entry) => [entry.date, entry])).values()].sort((a, b) =>
      a.date.localeCompare(b.date)
    )
  });

  const deleteResults: Array<Awaited<ReturnType<typeof deleteTimeOffEntryFromGoogleCalendar>>> = [];
  for (const entry of removals) {
    await deleteMembershipTimeOffEntry({
      id: entry.id,
      organizationUserId: authResult.membership.id
    });

    const result = await deleteTimeOffEntryFromGoogleCalendar({
      userId: authResult.session.user.id,
      timeOffEntryId: entry.id
    });

    deleteResults.push(result);
  }

  const syncResults = await Promise.all(
    entries.map((entry) => syncTimeOffEntryToGoogleCalendar({ userId: authResult.session.user.id, entry }))
  );
  const calendarStatus = await getGoogleCalendarStatus(authResult.session.user.id);

  return NextResponse.json({
    ok: true,
    entries,
    googleCalendar: {
      status: calendarStatus.status,
      results: [...syncResults, ...deleteResults]
    }
  });
}
