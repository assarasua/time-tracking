import { randomUUID } from "node:crypto";

import { sql } from "kysely";

import { kysely } from "@/lib/db/kysely";
import type { Database, JsonValue } from "@/lib/db/schema";

type Executor = typeof kysely;

type AnyRecord = Record<string, unknown>;

function now() {
  return new Date();
}

function id() {
  return randomUUID().replace(/-/g, "");
}

function createDb(executor: Executor): any {
  return {
    async $queryRawUnsafe(query: string) {
      return sql.raw(query).execute(executor);
    },

    async $transaction<T>(callback: (tx: ReturnType<typeof createDb>) => Promise<T>) {
      return executor.transaction().execute(async (trx) => callback(createDb(trx as Executor)));
    },

    organization: {
      async findUnique(args: { where: { id: string } }) {
        return (
          (await executor
            .selectFrom("Organization")
            .selectAll()
            .where("id", "=", args.where.id)
            .executeTakeFirst()) ?? null
        );
      },
      async findFirst(args?: { orderBy?: { createdAt?: "asc" | "desc" } }) {
        let q = executor.selectFrom("Organization").selectAll();
        const dir = args?.orderBy?.createdAt;
        if (dir) q = q.orderBy("createdAt", dir);
        return (await q.executeTakeFirst()) ?? null;
      },
      async findMany() {
        return executor.selectFrom("Organization").selectAll().execute();
      },
      async create(args: { data: AnyRecord }) {
        return (
          await executor
            .insertInto("Organization")
            .values({
              id: id(),
              name: String(args.data.name ?? "Default Organization"),
              timezone: String(args.data.timezone ?? "America/Los_Angeles"),
              weekStartDay: Number(args.data.weekStartDay ?? 1),
              createdAt: now(),
              updatedAt: now()
            })
            .returningAll()
            .executeTakeFirstOrThrow()
        );
      }
    },

    user: {
      async findUnique(args: { where: { id?: string; email?: string; googleSub?: string } }) {
        let q = executor.selectFrom("User").selectAll();
        if (args.where.id) q = q.where("id", "=", args.where.id);
        if (args.where.email) q = q.where("email", "=", args.where.email);
        if (args.where.googleSub) q = q.where("googleSub", "=", args.where.googleSub);
        return (await q.executeTakeFirst()) ?? null;
      },
      async create(args: { data: AnyRecord }) {
        return (
          await executor
            .insertInto("User")
            .values({
              id: id(),
              email: String(args.data.email),
              googleSub: String(args.data.googleSub),
              name: (args.data.name as string | null) ?? null,
              avatarUrl: (args.data.avatarUrl as string | null) ?? null,
              status: (args.data.status as "active" | "disabled") ?? "active",
              createdAt: now(),
              updatedAt: now()
            })
            .returningAll()
            .executeTakeFirstOrThrow()
        );
      },
      async update(args: { where: { id: string }; data: AnyRecord }) {
        return (
          await executor
            .updateTable("User")
            .set({ ...(args.data as AnyRecord), updatedAt: now() })
            .where("id", "=", args.where.id)
            .returningAll()
            .executeTakeFirstOrThrow()
        );
      }
    },

    organizationUser: {
      async findFirst(args: { where?: AnyRecord; include?: AnyRecord }) {
        let q = executor.selectFrom("OrganizationUser").selectAll();
        const where = args.where ?? {};
        if (where.userId) q = q.where("userId", "=", String(where.userId));
        if (where.organizationId) q = q.where("organizationId", "=", String(where.organizationId));
        if (typeof where.active === "boolean") q = q.where("active", "=", where.active);

        const membership = await q.executeTakeFirst();
        if (!membership) return null;

        if (!args.include) return membership;

        const out: AnyRecord = { ...membership };
        if ((args.include as AnyRecord).organization) {
          out.organization = await executor
            .selectFrom("Organization")
            .selectAll()
            .where("id", "=", membership.organizationId)
            .executeTakeFirst();
        }
        if ((args.include as AnyRecord).user) {
          out.user = await executor
            .selectFrom("User")
            .selectAll()
            .where("id", "=", membership.userId)
            .executeTakeFirst();
        }

        return out;
      },

      async findUnique(args: { where: AnyRecord }) {
        let q = executor.selectFrom("OrganizationUser").selectAll();
        if (args.where.id) {
          q = q.where("id", "=", String(args.where.id));
        } else if (args.where.organizationId_userId) {
          const pair = args.where.organizationId_userId as { organizationId: string; userId: string };
          q = q.where("organizationId", "=", pair.organizationId).where("userId", "=", pair.userId);
        }
        return (await q.executeTakeFirst()) ?? null;
      },

      async findMany(args?: { where?: AnyRecord; include?: AnyRecord; orderBy?: AnyRecord }) {
        let q = executor.selectFrom("OrganizationUser as ou").selectAll("ou");
        const where = args?.where ?? {};
        if (where.organizationId) q = q.where("ou.organizationId", "=", String(where.organizationId));
        if (where.id) q = q.where("ou.id", "=", String(where.id));
        if (typeof where.active === "boolean") q = q.where("ou.active", "=", where.active);
        if ((where.user as AnyRecord)?.status) {
          q = q
            .innerJoin("User as u", "u.id", "ou.userId")
            .where("u.status", "=", String((where.user as AnyRecord).status) as any);
        }

        if (args?.orderBy?.createdAt) {
          q = q.orderBy("ou.createdAt", args.orderBy.createdAt as "asc" | "desc");
        }

        const rows = await q.execute();
        if (!args?.include) return rows;

        return Promise.all(
          rows.map(async (row) => {
            const out: AnyRecord = { ...row };
            if ((args.include as AnyRecord).user) {
              out.user = await executor.selectFrom("User").selectAll().where("id", "=", row.userId).executeTakeFirst();
            }
            if ((args.include as AnyRecord).organization) {
              out.organization = await executor
                .selectFrom("Organization")
                .selectAll()
                .where("id", "=", row.organizationId)
                .executeTakeFirst();
            }
            if ((args.include as AnyRecord).timeSessions) {
              const tsWhere = (((args.include as AnyRecord).timeSessions as AnyRecord).where ?? {}) as AnyRecord;
              let tsQ = executor
                .selectFrom("TimeSession")
                .selectAll()
                .where("organizationUserId", "=", row.id);
              if ((tsWhere.startAt as AnyRecord)?.gte) {
                tsQ = tsQ.where("startAt", ">=", (tsWhere.startAt as AnyRecord).gte as Date);
              }
              if ((tsWhere.startAt as AnyRecord)?.lte) {
                tsQ = tsQ.where("startAt", "<=", (tsWhere.startAt as AnyRecord).lte as Date);
              }
              out.timeSessions = await tsQ.execute();
            }
            return out;
          })
        );
      },

      async count(args: { where: AnyRecord }) {
        let q = executor
          .selectFrom("OrganizationUser")
          .select((eb) => eb.fn.countAll<string>().as("count"));
        if (args.where.organizationId) q = q.where("organizationId", "=", String(args.where.organizationId));
        if (typeof args.where.active === "boolean") q = q.where("active", "=", args.where.active);
        const row = await q.executeTakeFirstOrThrow();
        return Number(row.count);
      },

      async create(args: { data: AnyRecord }) {
        return (
          await executor
            .insertInto("OrganizationUser")
            .values({
              id: id(),
              organizationId: String(args.data.organizationId),
              userId: String(args.data.userId),
              role: String(args.data.role) as any,
              weeklyTargetMinute: Number(args.data.weeklyTargetMinute ?? 2400),
              active: Boolean(args.data.active ?? true),
              createdAt: now(),
              updatedAt: now()
            })
            .returningAll()
            .executeTakeFirstOrThrow()
        );
      },

      async update(args: { where: { id: string }; data: AnyRecord }) {
        return (
          await executor
            .updateTable("OrganizationUser")
            .set({ ...(args.data as AnyRecord), updatedAt: now() })
            .where("id", "=", args.where.id)
            .returningAll()
            .executeTakeFirstOrThrow()
        );
      }
    },

    timeSession: {
      async findFirst(args: { where?: AnyRecord; select?: AnyRecord }) {
        const where = args.where ?? {};
        let q = executor.selectFrom("TimeSession").selectAll();
        if (where.organizationUserId) q = q.where("organizationUserId", "=", String(where.organizationUserId));
        if (where.endAt === null) q = q.where("endAt", "is", null);
        if ((where.startAt as AnyRecord)?.lt) q = q.where("startAt", "<", (where.startAt as AnyRecord).lt as Date);

        if (Array.isArray(where.OR as unknown[])) {
          q = q.where((eb) =>
            eb.or(
              (where.OR as AnyRecord[]).map((cond: AnyRecord) => {
                if (cond.endAt === null) return eb("endAt", "is", null);
                if ((cond.endAt as AnyRecord)?.gt) return eb("endAt", ">", (cond.endAt as AnyRecord).gt as Date);
                return eb("id", "is not", null);
              })
            )
          );
        }

        const row = await q.executeTakeFirst();
        if (!row) return null;
        if (args.select && (args.select as AnyRecord).id) return { id: row.id };
        return row;
      },

      async findUnique(args: { where: { id: string }; include?: AnyRecord }) {
        const row = await executor
          .selectFrom("TimeSession")
          .selectAll()
          .where("id", "=", args.where.id)
          .executeTakeFirst();
        if (!row) return null;

        if (!args.include) return row;

        const out: AnyRecord = { ...row };
        const orgUserInclude = (args.include.organizationUser as AnyRecord) ?? null;
        if (orgUserInclude) {
          const membership = await executor
            .selectFrom("OrganizationUser")
            .selectAll()
            .where("id", "=", row.organizationUserId)
            .executeTakeFirst();
          if (membership) {
            out.organizationUser = { ...membership };
            if ((orgUserInclude.include as AnyRecord)?.organization) {
              (out.organizationUser as AnyRecord).organization = await executor
                .selectFrom("Organization")
                .selectAll()
                .where("id", "=", membership.organizationId)
                .executeTakeFirst();
            }
          }
        }

        return out;
      },

      async findMany(args: { where?: AnyRecord; orderBy?: AnyRecord; select?: AnyRecord }) {
        const where = args.where ?? {};
        let q = executor.selectFrom("TimeSession as ts").selectAll("ts");

        if (where.organizationUserId) q = q.where("ts.organizationUserId", "=", String(where.organizationUserId));

        if ((where.organizationUser as AnyRecord)?.organizationId) {
          q = q
            .innerJoin("OrganizationUser as ou", "ou.id", "ts.organizationUserId")
            .where("ou.organizationId", "=", String((where.organizationUser as AnyRecord).organizationId));
        }

        if ((where.startAt as AnyRecord)?.gte) q = q.where("ts.startAt", ">=", (where.startAt as AnyRecord).gte as Date);
        if ((where.startAt as AnyRecord)?.lte) q = q.where("ts.startAt", "<=", (where.startAt as AnyRecord).lte as Date);
        if ((where.endAt as AnyRecord)?.not === null) q = q.where("ts.endAt", "is not", null);

        if (args.orderBy?.startAt) {
          q = q.orderBy("ts.startAt", args.orderBy.startAt as "asc" | "desc");
        }

        const rows = await q.execute();

        if (!args.select) return rows;

        return rows.map((row) => {
          const out: AnyRecord = {};
          for (const key of Object.keys(args.select ?? {})) {
            if ((args.select as AnyRecord)[key]) out[key] = (row as AnyRecord)[key];
          }
          return out;
        });
      },

      async create(args: { data: AnyRecord }) {
        return (
          await executor
            .insertInto("TimeSession")
            .values({
              id: id(),
              organizationUserId: String(args.data.organizationUserId),
              userId: String(args.data.userId),
              startAt: args.data.startAt as Date,
              endAt: (args.data.endAt as Date | null) ?? null,
              editedById: (args.data.editedById as string | null) ?? null,
              editReason: (args.data.editReason as string | null) ?? null,
              createdAt: now(),
              updatedAt: now()
            })
            .returningAll()
            .executeTakeFirstOrThrow()
        );
      },

      async update(args: { where: { id: string }; data: AnyRecord }) {
        return (
          await executor
            .updateTable("TimeSession")
            .set({ ...(args.data as AnyRecord), updatedAt: now() })
            .where("id", "=", args.where.id)
            .returningAll()
            .executeTakeFirstOrThrow()
        );
      },

      async delete(args: { where: { id: string } }) {
        await executor.deleteFrom("TimeSession").where("id", "=", args.where.id).executeTakeFirst();
      }
    },

    weekLock: {
      async findUnique(args: { where: AnyRecord }) {
        let q = executor.selectFrom("WeekLock").selectAll();
        if (args.where.id) q = q.where("id", "=", String(args.where.id));
        if (args.where.organizationId_weekStart) {
          const pair = args.where.organizationId_weekStart as { organizationId: string; weekStart: Date };
          q = q.where("organizationId", "=", pair.organizationId).where("weekStart", "=", pair.weekStart);
        }
        return (await q.executeTakeFirst()) ?? null;
      },
      async findMany(args: { where?: AnyRecord; orderBy?: AnyRecord; take?: number }) {
        let q = executor.selectFrom("WeekLock").selectAll();
        if (args.where?.organizationId) q = q.where("organizationId", "=", String(args.where.organizationId));
        if (args.orderBy?.weekStart) q = q.orderBy("weekStart", args.orderBy.weekStart as "asc" | "desc");
        if (args.take) q = q.limit(args.take);
        return q.execute();
      },
      async upsert(args: { where: AnyRecord; update: AnyRecord; create: AnyRecord }) {
        const existing = await (this as any).findUnique({ where: args.where });
        if (existing) {
          return (
            await executor
              .updateTable("WeekLock")
              .set(args.update as AnyRecord)
              .where("id", "=", existing.id)
              .returningAll()
              .executeTakeFirstOrThrow()
          );
        }

        const pair = args.where.organizationId_weekStart as { organizationId: string; weekStart: Date };
        return (
          await executor
            .insertInto("WeekLock")
            .values({
              id: id(),
              organizationId: pair.organizationId,
              weekStart: pair.weekStart,
              autoLocked: Boolean(args.create.autoLocked ?? false),
              lockedByUserId: (args.create.lockedByUserId as string | null) ?? null,
              lockedAt: now()
            })
            .returningAll()
            .executeTakeFirstOrThrow()
        );
      },
      async delete(args: { where: { id: string } }) {
        await executor.deleteFrom("WeekLock").where("id", "=", args.where.id).executeTakeFirst();
      }
    },

    auditLog: {
      async create(args: { data: AnyRecord }) {
        return (
          await executor
            .insertInto("AuditLog")
            .values({
              id: id(),
              actorUserId: (args.data.actorUserId as string | null) ?? null,
              entityType: String(args.data.entityType),
              entityId: String(args.data.entityId),
              action: String(args.data.action),
              beforeJson: (args.data.beforeJson as JsonValue | null) ?? null,
              afterJson: (args.data.afterJson as JsonValue | null) ?? null,
              createdAt: now()
            })
            .returningAll()
            .executeTakeFirstOrThrow()
        );
      }
    },

    appSession: {
      async create(args: { data: AnyRecord }) {
        return (
          await executor
            .insertInto("AppSession")
            .values({
              id: id(),
              userId: String(args.data.userId),
              organizationId: String(args.data.organizationId),
              tokenHash: String(args.data.tokenHash),
              expiresAt: args.data.expiresAt as Date,
              createdAt: now(),
              revokedAt: null
            })
            .returningAll()
            .executeTakeFirstOrThrow()
        );
      },
      async updateMany(args: { where: AnyRecord; data: AnyRecord }) {
        let q = executor.updateTable("AppSession").set(args.data as AnyRecord);
        if (args.where.tokenHash) q = q.where("tokenHash", "=", String(args.where.tokenHash));
        if (args.where.revokedAt === null) q = q.where("revokedAt", "is", null);
        const result = await q.executeTakeFirst();
        return { count: Number((result as any)?.numUpdatedRows ?? 0) };
      },
      async findUnique(args: { where: { tokenHash: string }; include?: AnyRecord }) {
        const row = await executor
          .selectFrom("AppSession")
          .selectAll()
          .where("tokenHash", "=", args.where.tokenHash)
          .executeTakeFirst();
        if (!row) return null;
        if (!args.include?.user) return row;

        const user = await executor.selectFrom("User").selectAll().where("id", "=", row.userId).executeTakeFirst();
        return { ...row, user };
      }
    }
  };
}

export const db = createDb(kysely as Executor);

export type DbClient = ReturnType<typeof createDb>;
export type DbSchema = Database;
