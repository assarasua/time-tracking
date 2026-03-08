import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { markMembershipExpensesPaid } from "@/lib/expenses";
import { ensureAdmin, requireSession } from "@/lib/rbac";

export const runtime = "nodejs";

const bodySchema = z.object({
  membershipId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/)
});

export async function POST(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const adminError = ensureAdmin(authResult.session.user.role);
  if (adminError) return adminError;

  const payload = bodySchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const updated = await markMembershipExpensesPaid({
    organizationId: authResult.membership.organizationId,
    organizationUserId: payload.data.membershipId,
    month: payload.data.month,
    paidByUserId: authResult.session.user.id
  });

  return NextResponse.json({ ok: true, updatedCount: updated.length });
}
