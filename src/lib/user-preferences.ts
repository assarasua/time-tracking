import { randomUUID } from "node:crypto";

import { kysely } from "@/lib/db/kysely";

export async function ensureUserPreferenceTable() {
  await kysely.schema
    .createTable("UserPreference")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("userId", "text", (col) => col.notNull().unique().references("User.id").onDelete("cascade"))
    .addColumn("timezone", "text", (col) => col.notNull())
    .addColumn("createdAt", "timestamptz", (col) => col.notNull().defaultTo(kysely.fn("now", [])))
    .addColumn("updatedAt", "timestamptz", (col) => col.notNull().defaultTo(kysely.fn("now", [])))
    .execute();
}

export async function getUserTimezonePreference(userId: string) {
  const row = await kysely
    .selectFrom("UserPreference")
    .select(["timezone"])
    .where("userId", "=", userId)
    .executeTakeFirst();

  return row?.timezone ?? null;
}

export async function setUserTimezonePreference(userId: string, timezone: string) {
  await kysely
    .insertInto("UserPreference")
    .values({
      id: randomUUID().replace(/-/g, ""),
      userId,
      timezone,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .onConflict((oc) =>
      oc.column("userId").doUpdateSet({
        timezone,
        updatedAt: new Date()
      })
    )
    .execute();
}
