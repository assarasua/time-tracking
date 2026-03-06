import { randomUUID } from "node:crypto";

import { sql } from "kysely";

import { kysely } from "@/lib/db/kysely";

export type TimeOffType = "vacation" | "unpaid_leave" | "not_working";
export type TimeOffStatus = "approved";

export type TimeOffEntry = {
  id: string;
  organizationId: string;
  organizationUserId: string;
  date: string;
  type: TimeOffType;
  status: TimeOffStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminTimeOffEntry = TimeOffEntry & {
  userId: string;
  userName: string | null;
  userEmail: string;
  role: string;
};

function toDateOnly(value: string | Date) {
  if (typeof value === "string") {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value.slice(0, 10);
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function ensureTimeOffEntryTable() {
  await kysely.schema
    .createTable("TimeOffEntry")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("organizationId", "text", (col) => col.notNull().references("Organization.id").onDelete("cascade"))
    .addColumn("organizationUserId", "text", (col) => col.notNull().references("OrganizationUser.id").onDelete("cascade"))
    .addColumn("date", "date", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull().defaultTo("vacation"))
    .addColumn("status", "text", (col) => col.notNull().defaultTo("approved"))
    .addColumn("createdAt", "timestamptz", (col) => col.notNull().defaultTo(kysely.fn("now", [])))
    .addColumn("updatedAt", "timestamptz", (col) => col.notNull().defaultTo(kysely.fn("now", [])))
    .execute();

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "TimeOffEntry_orgUser_date_key"
    ON "TimeOffEntry" ("organizationUserId", "date")
  `.execute(kysely);

  await sql`
    CREATE INDEX IF NOT EXISTS "TimeOffEntry_org_date_idx"
    ON "TimeOffEntry" ("organizationId", "date")
  `.execute(kysely);
}

export async function getMembershipTimeOffEntries({
  organizationUserId,
  from,
  to
}: {
  organizationUserId: string;
  from: string;
  to: string;
}) {
  await ensureTimeOffEntryTable();

  const rows = await kysely
    .selectFrom("TimeOffEntry")
    .selectAll()
    .where("organizationUserId", "=", organizationUserId)
    .where("date", ">=", toUtcDate(from))
    .where("date", "<=", toUtcDate(to))
    .orderBy("date", "asc")
    .execute();

  return rows.map((row) => ({
    ...row,
    date: toDateOnly(row.date)
  })) as TimeOffEntry[];
}

export async function upsertMembershipTimeOffEntries({
  organizationId,
  organizationUserId,
  entries
}: {
  organizationId: string;
  organizationUserId: string;
  entries: Array<{ date: string; type: TimeOffType }>;
}) {
  await ensureTimeOffEntryTable();

  if (entries.length === 0) return [];

  const inserted = await kysely
    .insertInto("TimeOffEntry")
    .values(
      entries.map((entry) => ({
        id: randomUUID().replace(/-/g, ""),
        organizationId,
        organizationUserId,
        date: toUtcDate(entry.date),
        type: entry.type,
        status: "approved",
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    )
    .onConflict((oc) =>
      oc.columns(["organizationUserId", "date"]).doUpdateSet({
        status: "approved",
        type: (eb) => eb.ref("excluded.type"),
        updatedAt: new Date()
      })
    )
    .returningAll()
    .execute();

  return inserted.map((row) => ({
    ...row,
    date: toDateOnly(row.date)
  })) as TimeOffEntry[];
}

export async function deleteMembershipTimeOffEntry({
  id,
  organizationUserId
}: {
  id: string;
  organizationUserId: string;
}) {
  await ensureTimeOffEntryTable();

  const deleted = await kysely
    .deleteFrom("TimeOffEntry")
    .where("id", "=", id)
    .where("organizationUserId", "=", organizationUserId)
    .returning(["id"])
    .executeTakeFirst();

  return Boolean(deleted);
}

export async function getMembershipTimeOffEntryById({
  id,
  organizationUserId
}: {
  id: string;
  organizationUserId: string;
}) {
  await ensureTimeOffEntryTable();

  const row = await kysely
    .selectFrom("TimeOffEntry")
    .selectAll()
    .where("id", "=", id)
    .where("organizationUserId", "=", organizationUserId)
    .executeTakeFirst();

  if (!row) return null;

  return {
    ...row,
    date: toDateOnly(row.date)
  } as TimeOffEntry;
}

export async function getAdminTimeOffEntries({
  organizationId,
  from,
  to
}: {
  organizationId: string;
  from: string;
  to: string;
}) {
  await ensureTimeOffEntryTable();

  const rows = await kysely
    .selectFrom("TimeOffEntry as toe")
    .innerJoin("OrganizationUser as ou", "ou.id", "toe.organizationUserId")
    .innerJoin("User as u", "u.id", "ou.userId")
    .select([
      "toe.id as id",
      "toe.organizationId as organizationId",
      "toe.organizationUserId as organizationUserId",
      "toe.date as date",
      "toe.type as type",
      "toe.status as status",
      "toe.createdAt as createdAt",
      "toe.updatedAt as updatedAt",
      "u.id as userId",
      "u.name as userName",
      "u.email as userEmail",
      "ou.role as role"
    ])
    .where("toe.organizationId", "=", organizationId)
    .where("toe.date", ">=", toUtcDate(from))
    .where("toe.date", "<=", toUtcDate(to))
    .orderBy("toe.date", "asc")
    .orderBy("u.name", "asc")
    .execute();

  return rows.map((row) => ({
    ...row,
    date: toDateOnly(row.date)
  })) as AdminTimeOffEntry[];
}
