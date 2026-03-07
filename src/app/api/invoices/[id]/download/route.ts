import { NextRequest, NextResponse } from "next/server";

import { getMembershipInvoiceBinary } from "@/lib/invoices";
import { requireSession } from "@/lib/rbac";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const { id } = await context.params;
  const invoice = await getMembershipInvoiceBinary({ id, organizationUserId: authResult.membership.id });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  const fileBytes = invoice.fileData instanceof Uint8Array ? invoice.fileData : new Uint8Array(invoice.fileData);
  const safeBytes = new Uint8Array(fileBytes.byteLength);
  safeBytes.set(fileBytes);
  const body = new Blob([safeBytes.buffer], { type: invoice.mimeType });

  return new NextResponse(body, {
    headers: {
      "content-type": invoice.mimeType,
      "content-length": String(invoice.fileSizeBytes),
      "content-disposition": `${disposition}; filename="${invoice.fileName.replace(/"/g, "")}"`
    }
  });
}
