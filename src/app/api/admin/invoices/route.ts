import { NextRequest, NextResponse } from "next/server";

import { getAdminInvoicesForMonth } from "@/lib/invoices";
import { ensureAdmin, requireSession } from "@/lib/rbac";
import { invoiceMonthQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const adminError = ensureAdmin(authResult.session.user.role);
  if (adminError) return adminError;

  const query = invoiceMonthQuerySchema.safeParse({
    month: request.nextUrl.searchParams.get("month")
  });

  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  const invoices = await getAdminInvoicesForMonth({
    organizationId: authResult.membership.organizationId,
    month: query.data.month
  });

  return NextResponse.json({ month: query.data.month, invoices });
}
