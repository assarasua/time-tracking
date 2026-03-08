import { NextRequest, NextResponse } from "next/server";

import { getAdminExpensesForMonth } from "@/lib/expenses";
import { ensureAdmin, requireSession } from "@/lib/rbac";
import { expenseMonthQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const adminError = ensureAdmin(authResult.session.user.role);
  if (adminError) return adminError;

  const query = expenseMonthQuerySchema.safeParse({
    month: request.nextUrl.searchParams.get("month")
  });

  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  const expenses = await getAdminExpensesForMonth({
    organizationId: authResult.membership.organizationId,
    month: query.data.month
  });

  return NextResponse.json({ month: query.data.month, expenses });
}
