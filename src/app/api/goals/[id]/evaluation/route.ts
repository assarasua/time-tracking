import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getGoalById, updateGoalEvaluation } from "@/lib/goals";
import { ensureAdmin, requireSession } from "@/lib/rbac";
import { saveGoalEvaluationSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireSession();
  if (authResult.error) return authResult.error;

  const adminError = ensureAdmin(authResult.session.user.role);
  if (adminError) return adminError;

  const payload = saveGoalEvaluationSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const goal = await getGoalById(id);
  if (!goal || goal.organizationId !== authResult.membership.organizationId) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  if (goal.organizationUserId) {
    const membership = await db.organizationUser.findFirst({
      where: { id: goal.organizationUserId, organizationId: authResult.membership.organizationId, active: true }
    });
    if (!membership) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const updated = await updateGoalEvaluation({
    goalId: id,
    organizationId: authResult.membership.organizationId,
    status: payload.data.status,
    achievementStatus: payload.data.status === "completed" ? payload.data.achievementStatus : null,
    actualValue: payload.data.status === "completed" ? payload.data.actualValue : null,
    evaluationNote: payload.data.evaluationNote ?? null,
    completedByUserId: authResult.session.user.id
  });

  if (!updated) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  return NextResponse.json({ ok: true, goal: updated });
}
