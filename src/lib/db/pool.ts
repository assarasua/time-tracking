import { Pool } from "pg";

import { cleanEnv } from "@/lib/env-utils";

const databaseUrl = cleanEnv(process.env.DATABASE_URL);

const globalForPool = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPool.pgPool ??
  new Pool({
    connectionString: databaseUrl || undefined,
    ssl:
      cleanEnv(process.env.PGSSLMODE).toLowerCase() === "disable"
        ? false
        : {
            rejectUnauthorized: false
          }
  });

if (process.env.NODE_ENV !== "production") {
  globalForPool.pgPool = pool;
}
