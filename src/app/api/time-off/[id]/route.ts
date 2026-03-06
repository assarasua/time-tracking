import { NextResponse } from "next/server";
import { format } from "date-fns";

import { requireSession } from "@/lib/rbac";
import { deleteMembershipTimeOffEntry, getMembershipTimeOffEntryById } from "@/lib/time-off";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_: Request, context: RouteContext) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const { id } = await context.params;
  const entry = await getMembershipTimeOffEntryById({
    id,
    organizationUserId: authResult.membership.id
  });

  if (!entry) {
    return NextResponse.json({ error: "Time off entry not found" }, { status: 404 });
  }

  const today = format(new Date(), "yyyy-MM-dd");
  if (entry.date < today) {
    return NextResponse.json({ error: "Past days off cannot be modified." }, { status: 403 });
  }

  const deleted = await deleteMembershipTimeOffEntry({
    id,
    organizationUserId: authResult.membership.id
  });

  if (!deleted) {
    return NextResponse.json({ error: "Time off entry not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
