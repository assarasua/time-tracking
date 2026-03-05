import { Kysely, PostgresDialect } from "kysely";

import type { Database } from "@/lib/db/schema";
import { pool } from "@/lib/db/pool";

const globalForKysely = globalThis as unknown as { kysely?: Kysely<Database> };

export const kysely =
  globalForKysely.kysely ??
  new Kysely<Database>({
    dialect: new PostgresDialect({
      pool
    })
  });

if (process.env.NODE_ENV !== "production") {
  globalForKysely.kysely = kysely;
}
