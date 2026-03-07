import "server-only";

import { randomUUID } from "node:crypto";

import { sql } from "kysely";

import { kysely } from "@/lib/db/kysely";

export type GoalStatus = "in_progress" | "completed";
export type GoalAchievementStatus = "achieved" | "not_achieved";

export type GoalRecord = {
  id: string;
  organizationId: string;
  organizationUserId: string | null;
  quarterKey: string;
  title: string;
  metric: string;
  targetValue: number;
  currentValue: number;
  actualValue: number | null;
  unit: string;
  status: GoalStatus;
  achievementStatus: GoalAchievementStatus | null;
  evaluationNote: string | null;
  completedAt: Date | null;
  completedByUserId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type GoalInput = Pick<GoalRecord, "title" | "metric" | "targetValue" | "currentValue" | "unit" | "sortOrder">;

function now() {
  return new Date();
}

export async function ensureGoalTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS "Goal" (
      "id" text PRIMARY KEY,
      "organizationId" text NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
      "organizationUserId" text REFERENCES "OrganizationUser"("id") ON DELETE CASCADE,
      "quarterKey" text NOT NULL,
      "title" text NOT NULL,
      "metric" text NOT NULL,
      "targetValue" double precision NOT NULL,
      "currentValue" double precision NOT NULL,
      "actualValue" double precision,
      "unit" text NOT NULL,
      "status" text NOT NULL DEFAULT 'in_progress',
      "achievementStatus" text,
      "evaluationNote" text,
      "completedAt" timestamptz,
      "completedByUserId" text REFERENCES "User"("id") ON DELETE SET NULL,
      "sortOrder" integer NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `.execute(kysely);

  await sql`ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "organizationUserId" text REFERENCES "OrganizationUser"("id") ON DELETE CASCADE`.execute(kysely);
  await sql`ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "actualValue" double precision`.execute(kysely);
  await sql`ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'in_progress'`.execute(kysely);
  await sql`ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "achievementStatus" text`.execute(kysely);
  await sql`ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "evaluationNote" text`.execute(kysely);
  await sql`ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "completedAt" timestamptz`.execute(kysely);
  await sql`ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "completedByUserId" text REFERENCES "User"("id") ON DELETE SET NULL`.execute(kysely);

  await sql`DROP INDEX IF EXISTS "Goal_org_quarter_sort_key"`.execute(kysely);
  await sql`DROP INDEX IF EXISTS "Goal_org_quarter_idx"`.execute(kysely);

  await sql`
    CREATE INDEX IF NOT EXISTS "Goal_org_user_quarter_idx"
    ON "Goal" ("organizationId", "organizationUserId", "quarterKey")
  `.execute(kysely);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "Goal_org_user_quarter_sort_key"
    ON "Goal" ("organizationId", "organizationUserId", "quarterKey", "sortOrder")
  `.execute(kysely);
}

export async function getGoalsForQuarter({ organizationId, organizationUserId, quarterKey }: { organizationId: string; organizationUserId: string; quarterKey: string; }) {
  await ensureGoalTable();

  return kysely
    .selectFrom("Goal")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("organizationUserId", "=", organizationUserId)
    .where("quarterKey", "=", quarterKey)
    .orderBy("sortOrder", "asc")
    .execute() as Promise<GoalRecord[]>;
}

export async function getGoalsForQuarterByMembers({ organizationId, quarterKey }: { organizationId: string; quarterKey: string; }) {
  await ensureGoalTable();

  return kysely
    .selectFrom("Goal as g")
    .innerJoin("OrganizationUser as ou", "ou.id", "g.organizationUserId")
    .innerJoin("User as u", "u.id", "ou.userId")
    .select([
      "g.id as id",
      "g.organizationId as organizationId",
      "g.organizationUserId as organizationUserId",
      "g.quarterKey as quarterKey",
      "g.title as title",
      "g.metric as metric",
      "g.targetValue as targetValue",
      "g.currentValue as currentValue",
      "g.actualValue as actualValue",
      "g.unit as unit",
      "g.status as status",
      "g.achievementStatus as achievementStatus",
      "g.evaluationNote as evaluationNote",
      "g.completedAt as completedAt",
      "g.completedByUserId as completedByUserId",
      "g.sortOrder as sortOrder",
      "g.createdAt as createdAt",
      "g.updatedAt as updatedAt",
      "ou.id as membershipId",
      "u.name as userName",
      "u.email as userEmail"
    ])
    .where("g.organizationId", "=", organizationId)
    .where("g.quarterKey", "=", quarterKey)
    .orderBy("u.name", "asc")
    .orderBy("u.email", "asc")
    .orderBy("g.sortOrder", "asc")
    .execute();
}

export async function getGoalById(goalId: string) {
  await ensureGoalTable();

  return kysely.selectFrom("Goal").selectAll().where("id", "=", goalId).executeTakeFirst() as Promise<GoalRecord | undefined>;
}

export async function replaceGoalsForQuarter({ organizationId, organizationUserId, quarterKey, goals }: { organizationId: string; organizationUserId: string; quarterKey: string; goals: GoalInput[]; }) {
  await ensureGoalTable();

  try {
    return await kysely.transaction().execute(async (trx) => {
      const existingGoals = (await trx
        .selectFrom("Goal")
        .selectAll()
        .where("organizationId", "=", organizationId)
        .where("organizationUserId", "=", organizationUserId)
        .where("quarterKey", "=", quarterKey)
        .orderBy("sortOrder", "asc")
        .execute()) as GoalRecord[];

      const preservedBySortOrder = new Map(existingGoals.map((goal) => [goal.sortOrder, goal]));

      await trx
        .deleteFrom("Goal")
        .where("organizationId", "=", organizationId)
        .where("organizationUserId", "=", organizationUserId)
        .where("quarterKey", "=", quarterKey)
        .execute();

      if (!goals.length) return [] as GoalRecord[];

      const inserted = await trx
        .insertInto("Goal")
        .values(goals.map((goal) => {
          const preserved = preservedBySortOrder.get(goal.sortOrder);
          return {
            id: randomUUID().replace(/-/g, ""),
            organizationId,
            organizationUserId,
            quarterKey,
            title: goal.title,
            metric: goal.metric,
            targetValue: goal.targetValue,
            currentValue: goal.currentValue,
            actualValue: preserved?.actualValue ?? null,
            unit: goal.unit,
            status: preserved?.status ?? "in_progress",
            achievementStatus: preserved?.achievementStatus ?? null,
            evaluationNote: preserved?.evaluationNote ?? null,
            completedAt: preserved?.completedAt ?? null,
            completedByUserId: preserved?.completedByUserId ?? null,
            sortOrder: goal.sortOrder,
            createdAt: now(),
            updatedAt: now()
          };
        }))
        .returningAll()
        .execute();

      return inserted as GoalRecord[];
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown goal save failure";
    throw new Error(`Unable to save quarterly goals: ${message}`);
  }
}

export async function updateGoalEvaluation({ goalId, organizationId, status, achievementStatus, actualValue, evaluationNote, completedByUserId }: { goalId: string; organizationId: string; status: GoalStatus; achievementStatus: GoalAchievementStatus | null; actualValue: number | null; evaluationNote: string | null; completedByUserId: string; }) {
  await ensureGoalTable();

  const completionDate = status === "completed" ? now() : null;

  return kysely
    .updateTable("Goal")
    .set({
      status,
      achievementStatus,
      actualValue,
      evaluationNote,
      completedAt: completionDate,
      completedByUserId: status === "completed" ? completedByUserId : null,
      updatedAt: now()
    })
    .where("id", "=", goalId)
    .where("organizationId", "=", organizationId)
    .returningAll()
    .executeTakeFirst() as Promise<GoalRecord | undefined>;
}
