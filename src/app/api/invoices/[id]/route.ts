import { NextRequest, NextResponse } from "next/server";

import { deleteMembershipInvoice, normalizeInvoiceAmount, updateMembershipInvoiceAmount } from "@/lib/invoices";
import { requireSession } from "@/lib/rbac";

export const runtime = "nodejs";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const { id } = await params;
  const invoice = await deleteMembershipInvoice({
    id,
    organizationUserId: authResult.membership.id
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, invoiceId: id });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const payload = await request.json();
  const totalAmount = normalizeInvoiceAmount(String(payload?.amount ?? ""));
  const { id } = await params;

  const invoice = await updateMembershipInvoiceAmount({
    id,
    organizationUserId: authResult.membership.id,
    totalAmount
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, invoice });
}
