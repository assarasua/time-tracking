import { NextRequest, NextResponse } from "next/server";

import { getCurrentQuarterRange } from "@/lib/quarter-range";
import { getGoalsForQuarter, replaceGoalsForQuarter } from "@/lib/goals";
import { requireSession } from "@/lib/rbac";
import { db } from "@/lib/db";
import { quarterQuerySchema, saveGoalsSchema } from "@/lib/validation";

export const runtime = "nodejs";

async function ensureMembershipInOrganization(membershipId: string, organizationId: string) {
  return db.organizationUser.findFirst({
    where: {
      id: membershipId,
      organizationId,
      active: true
    }
  });
}

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const parsed = quarterQuerySchema.safeParse({
    quarter: request.nextUrl.searchParams.get("quarter") ?? getCurrentQuarterRange().quarterKey
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const requestedMembershipId = request.nextUrl.searchParams.get("membership_id");
  const targetMembershipId =
    authResult.session.user.role === "admin" && requestedMembershipId ? requestedMembershipId : authResult.membership.id;

  const membership = await ensureMembershipInOrganization(targetMembershipId, authResult.membership.organizationId);
  if (!membership) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const goals = await getGoalsForQuarter({
    organizationId: authResult.membership.organizationId,
    organizationUserId: targetMembershipId,
    quarterKey: parsed.data.quarter
  });

  return NextResponse.json({
    quarter: parsed.data.quarter,
    membershipId: targetMembershipId,
    goals
  });
}

export async function PUT(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const payload = saveGoalsSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const targetMembershipId =
    authResult.session.user.role === "admin" ? payload.data.membership_id : authResult.membership.id;

  const membership = await ensureMembershipInOrganization(targetMembershipId, authResult.membership.organizationId);
  if (!membership) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const goals = await replaceGoalsForQuarter({
    organizationId: authResult.membership.organizationId,
    organizationUserId: targetMembershipId,
    quarterKey: payload.data.quarter,
    goals: payload.data.goals.map((goal, index) => ({
      ...goal,
      sortOrder: index
    }))
  });

  return NextResponse.json({
    ok: true,
    quarter: payload.data.quarter,
    goals
  });
}
