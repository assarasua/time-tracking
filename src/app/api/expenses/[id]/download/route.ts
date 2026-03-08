import { NextRequest, NextResponse } from "next/server";

import { getMembershipExpenseBinary } from "@/lib/expenses";
import { requireSession } from "@/lib/rbac";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const { id } = await context.params;
  const expense = await getMembershipExpenseBinary({ id, organizationUserId: authResult.membership.id });

  if (!expense) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }

  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  const fileBytes = expense.fileData instanceof Uint8Array ? expense.fileData : new Uint8Array(expense.fileData);
  const safeBytes = new Uint8Array(fileBytes.byteLength);
  safeBytes.set(fileBytes);
  const body = new Blob([safeBytes.buffer], { type: expense.mimeType });

  return new NextResponse(body, {
    headers: {
      "content-type": expense.mimeType,
      "content-length": String(expense.fileSizeBytes),
      "content-disposition": `${disposition}; filename="${expense.fileName.replace(/"/g, "")}"`
    }
  });
}
