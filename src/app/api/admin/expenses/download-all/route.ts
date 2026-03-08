import { format } from "date-fns";
import { zipSync } from "fflate";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminExpensesForMembershipMonth } from "@/lib/expenses";
import { ensureAdmin, requireSession } from "@/lib/rbac";

export const runtime = "nodejs";

const querySchema = z.object({
  membershipId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/)
});

function sanitizeFilePart(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const adminError = ensureAdmin(authResult.session.user.role);
  if (adminError) return adminError;

  const query = querySchema.safeParse({
    membershipId: request.nextUrl.searchParams.get("membershipId"),
    month: request.nextUrl.searchParams.get("month")
  });

  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  const expenses = await getAdminExpensesForMembershipMonth({
    organizationId: authResult.membership.organizationId,
    organizationUserId: query.data.membershipId,
    month: query.data.month
  });

  if (!expenses.length) {
    return NextResponse.json({ error: "No expenses found for this employee and month." }, { status: 404 });
  }

  const zipEntries: Record<string, Uint8Array> = {};
  for (const [index, expense] of expenses.entries()) {
    const fileBytes = expense.fileData instanceof Uint8Array ? expense.fileData : new Uint8Array(expense.fileData as ArrayBuffer);
    const safeBytes = new Uint8Array(fileBytes.byteLength);
    safeBytes.set(fileBytes);
    const dateLabel = expense.expenseDate;
    const referencePart = sanitizeFilePart(expense.reference || `expense_${index + 1}`);
    const originalPart = sanitizeFilePart(expense.fileName);
    zipEntries[`${dateLabel}_${referencePart}_${originalPart}`] = safeBytes;
  }

  const zipBytes = zipSync(zipEntries, { level: 0 });
  const [year, monthNumber] = query.data.month.split("-").map(Number);
  const monthLabel = format(new Date(year, monthNumber - 1, 1), "MMMM-yyyy");
  const userName = sanitizeFilePart(expenses[0].userName || expenses[0].userEmail.split("@")[0] || "user");
  const archiveName = `${userName}_${monthLabel}_expenses.zip`;

  return new NextResponse(Buffer.from(zipBytes), {
    headers: {
      "content-type": "application/zip",
      "content-length": String(zipBytes.byteLength),
      "content-disposition": `attachment; filename="${archiveName}"`
    }
  });
}
