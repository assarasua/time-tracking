import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { formatInvoiceMonthValue, markInvoicePaid, sendInvoicePaidNotification } from "@/lib/invoices";
import { ensureAdmin, requireSession } from "@/lib/rbac";

export const runtime = "nodejs";

const bodySchema = z.object({
  invoiceId: z.string().min(1)
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

  const invoice = await markInvoicePaid({
    invoiceId: payload.data.invoiceId,
    organizationId: authResult.membership.organizationId,
    paidByUserId: authResult.session.user.id
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found or already paid." }, { status: 404 });
  }

  let notificationSent = false;
  let notificationError: string | null = null;
  const invoiceMonth = formatInvoiceMonthValue(invoice.invoiceMonth);

  try {
    const notification = await sendInvoicePaidNotification({
      organizationId: authResult.membership.organizationId,
      organizationUserId: invoice.organizationUserId,
      month: invoiceMonth,
      totalAmount: Number(invoice.totalAmount),
      paidAt: invoice.paidAt ?? new Date(),
      fileName: invoice.fileName
    });
    notificationSent = notification.sent;
  } catch (error) {
    notificationError = error instanceof Error ? error.message : "Unable to send paid-invoice email.";
    console.error("invoice_paid_email_failed", {
      organizationId: authResult.membership.organizationId,
      invoiceId: payload.data.invoiceId,
      organizationUserId: invoice.organizationUserId,
      month: invoiceMonth,
      error: notificationError
    });
  }

  return NextResponse.json({ ok: true, notificationSent, notificationError });
}
