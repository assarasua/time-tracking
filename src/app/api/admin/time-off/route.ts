import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/lib/db/schema";
import { requireSession } from "@/lib/rbac";
import { getAdminTimeOffEntries } from "@/lib/time-off";
import { timeOffQuerySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  if (authResult.membership.role !== Role.admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const query = timeOffQuerySchema.safeParse({
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to")
  });

  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  const entries = await getAdminTimeOffEntries({
    organizationId: authResult.membership.organizationId,
    from: query.data.from,
    to: query.data.to
  });

  return NextResponse.json({
    from: query.data.from,
    to: query.data.to,
    entries
  });
}
