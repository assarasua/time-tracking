import { Pool } from "pg";

import { cleanEnv } from "@/lib/env-utils";

const privateDatabaseUrl = cleanEnv(process.env.DATABASE_PRIVATE_URL);
const publicDatabaseUrl = cleanEnv(process.env.DATABASE_URL);
const databaseUrl = privateDatabaseUrl || publicDatabaseUrl;
const isRailwayInternal = databaseUrl.includes(".railway.internal");

const globalForPool = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPool.pgPool ??
  new Pool({
    connectionString: databaseUrl || undefined,
    // Railway private network does not require SSL/TLS.
    ...(isRailwayInternal ? { ssl: false } : {})
  });

if (process.env.NODE_ENV !== "production") {
  globalForPool.pgPool = pool;
}
