import { Pool } from "pg";

import { cleanEnv } from "@/lib/env-utils";

const databaseUrl = cleanEnv(process.env.DATABASE_URL);

const globalForPool = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPool.pgPool ??
  new Pool({
    // Let pg parse ssl settings from DATABASE_URL (`sslmode=...`).
    connectionString: databaseUrl || undefined
  });

if (process.env.NODE_ENV !== "production") {
  globalForPool.pgPool = pool;
}
