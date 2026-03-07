import { NextRequest, NextResponse } from "next/server";

import { getMembershipInvoiceForMonth, getMembershipInvoices, normalizeInvoiceMonth, sendInvoiceUploadNotifications, upsertMembershipInvoice, validateInvoiceUpload } from "@/lib/invoices";
import { requireSession } from "@/lib/rbac";
import { invoiceMonthQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const includeAll = request.nextUrl.searchParams.get("all") === "1";
  if (includeAll) {
    const invoices = await getMembershipInvoices({
      organizationUserId: authResult.membership.id
    });

    return NextResponse.json({ invoices });
  }

  const query = invoiceMonthQuerySchema.safeParse({
    month: request.nextUrl.searchParams.get("month")
  });

  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  const invoice = await getMembershipInvoiceForMonth({
    organizationUserId: authResult.membership.id,
    month: query.data.month
  });

  return NextResponse.json({ month: query.data.month, invoice });
}

export async function POST(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  try {
    const formData = await request.formData();
    const rawMonth = formData.get("month");
    const file = formData.get("file");

    if (typeof rawMonth !== "string") {
      return NextResponse.json({ error: "Invoice month is required." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Invoice PDF is required." }, { status: 400 });
    }

    const month = normalizeInvoiceMonth(rawMonth);
    validateInvoiceUpload(file);
    const existingInvoice = await getMembershipInvoiceForMonth({
      organizationUserId: authResult.membership.id,
      month
    });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const invoice = await upsertMembershipInvoice({
      organizationId: authResult.membership.organizationId,
      organizationUserId: authResult.membership.id,
      uploadedByUserId: authResult.session.user.id,
      month,
      fileName: file.name,
      mimeType: "application/pdf",
      fileSizeBytes: file.size,
      fileData: bytes
    });

    let notificationSent = false;
    try {
      const notification = await sendInvoiceUploadNotifications({
        organizationId: authResult.membership.organizationId,
      uploaderName: authResult.session.user.name ?? null,
      uploaderEmail: authResult.session.user.email,
      membershipId: authResult.membership.id,
      month,
      fileName: invoice.fileName,
      mimeType: "application/pdf",
      fileData: bytes,
      uploadedAt: invoice.updatedAt,
      replaced: Boolean(existingInvoice)
    });
      notificationSent = notification.sent > 0;
    } catch (emailError) {
      console.error("invoice_admin_email_failed", {
        organizationId: authResult.membership.organizationId,
        membershipId: authResult.membership.id,
        month,
        recipientCount: 0,
        error: emailError instanceof Error ? emailError.message : "unknown"
      });
    }

    return NextResponse.json({ ok: true, invoice, notificationSent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload invoice.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
