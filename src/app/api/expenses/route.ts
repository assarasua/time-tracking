import { NextRequest, NextResponse } from "next/server";

import {
  getMembershipExpensesForMonth,
  insertMembershipExpense,
  normalizeExpenseDate,
  normalizeExpenseMonth,
  parseExpenseAmount,
  validateExpenseDateInMonth,
  validateExpenseReference,
  validateExpenseUpload
} from "@/lib/expenses";
import { requireSession } from "@/lib/rbac";
import { expenseMonthQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const query = expenseMonthQuerySchema.safeParse({
    month: request.nextUrl.searchParams.get("month")
  });

  if (!query.success) {
    return NextResponse.json({ error: query.error.flatten() }, { status: 400 });
  }

  const expenses = await getMembershipExpensesForMonth({
    organizationUserId: authResult.membership.id,
    month: query.data.month
  });

  return NextResponse.json({ month: query.data.month, expenses });
}

export async function POST(request: NextRequest) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  try {
    const formData = await request.formData();
    const rawMonth = formData.get("month");
    const rawExpenseDate = formData.get("expense_date");
    const rawAmount = formData.get("total_amount");
    const rawReference = formData.get("reference");
    const file = formData.get("file");

    if (typeof rawMonth !== "string") {
      return NextResponse.json({ error: "Expense month is required." }, { status: 400 });
    }
    if (typeof rawExpenseDate !== "string") {
      return NextResponse.json({ error: "Expense date is required." }, { status: 400 });
    }
    if (typeof rawAmount !== "string") {
      return NextResponse.json({ error: "Expense amount is required." }, { status: 400 });
    }
    if (typeof rawReference !== "string") {
      return NextResponse.json({ error: "Expense reference is required." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Receipt file is required." }, { status: 400 });
    }

    const month = normalizeExpenseMonth(rawMonth);
    const expenseDate = normalizeExpenseDate(rawExpenseDate);
    validateExpenseDateInMonth({ month, expenseDate });
    const totalAmount = parseExpenseAmount(rawAmount);
    const reference = validateExpenseReference(rawReference);
    validateExpenseUpload(file);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const expense = await insertMembershipExpense({
      organizationId: authResult.membership.organizationId,
      organizationUserId: authResult.membership.id,
      uploadedByUserId: authResult.session.user.id,
      month,
      expenseDate,
      reference,
      totalAmount,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSizeBytes: file.size,
      fileData: bytes
    });

    return NextResponse.json({ ok: true, expense });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload expense.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
