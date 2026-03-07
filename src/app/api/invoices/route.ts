import { NextRequest, NextResponse } from "next/server";

import { getMembershipInvoiceForMonth, getMembershipInvoices, normalizeInvoiceMonth, upsertMembershipInvoice, validateInvoiceUpload } from "@/lib/invoices";
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

    return NextResponse.json({ ok: true, invoice });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload invoice.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
