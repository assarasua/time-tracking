import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { markMembershipExpensesPaid, sendExpensePaidNotification } from "@/lib/expenses";
import { ensureAdmin, requireSession } from "@/lib/rbac";

export const runtime = "nodejs";

const bodySchema = z.object({
  membershipId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/)
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

  const updated = await markMembershipExpensesPaid({
    organizationId: authResult.membership.organizationId,
    organizationUserId: payload.data.membershipId,
    month: payload.data.month,
    paidByUserId: authResult.session.user.id
  });

  let notificationSent = false;
  let notificationError: string | null = null;

  if (updated.length > 0) {
    try {
      const paidAt = updated[0]?.paidAt ?? new Date();
      const notification = await sendExpensePaidNotification({
        organizationId: authResult.membership.organizationId,
        organizationUserId: payload.data.membershipId,
        month: payload.data.month,
        paidAt,
        expenses: updated.map((expense) => ({
          reference: expense.reference,
          totalAmount: Number(expense.totalAmount),
          expenseDate: `${expense.expenseDate}`.slice(0, 10)
        }))
      });
      notificationSent = notification.sent;
    } catch (error) {
      notificationError = error instanceof Error ? error.message : "Unable to send paid-expenses email.";
      console.error("expense_paid_email_failed", {
        organizationId: authResult.membership.organizationId,
        membershipId: payload.data.membershipId,
        month: payload.data.month,
        updatedCount: updated.length,
        error: notificationError
      });
    }
  }

  return NextResponse.json({ ok: true, updatedCount: updated.length, notificationSent, notificationError });
}
