import { NextRequest, NextResponse } from "next/server";

import { deleteMembershipExpense } from "@/lib/expenses";
import { requireSession } from "@/lib/rbac";

export const runtime = "nodejs";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const { id } = await params;
  const expense = await deleteMembershipExpense({
    id,
    organizationUserId: authResult.membership.id
  });

  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, expenseId: id });
}
