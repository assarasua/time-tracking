import { NextRequest } from "next/server";

import { getAppBaseUrl } from "@/lib/app-config";
import { db } from "@/lib/db";
import { classifyDatabaseError } from "@/lib/auth/db-error";
import { cleanEnv } from "@/lib/env-utils";
import { getRequestBaseUrl } from "@/lib/request-url";

const REQUIRED_AUTH_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_SECRET"
] as const;

export function getAuthDiagnostics(request?: NextRequest) {
  const envStatus = Object.fromEntries(
    REQUIRED_AUTH_ENV_VARS.map((key) => {
      const value = cleanEnv(process.env[key]);
      return [
        key,
        {
          present: value.length > 0,
          length: value.length
        }
      ];
    })
  );

  const missing = REQUIRED_AUTH_ENV_VARS.filter((key) => !envStatus[key].present);
  const appBaseUrl = getAppBaseUrl();
  const appBaseUrlFromEnv = cleanEnv(process.env.APP_BASE_URL);
  const requestBaseUrl = request ? getRequestBaseUrl(request) : null;
  const databasePrivateUrl = cleanEnv(process.env.DATABASE_PRIVATE_URL);
  const databasePublicUrl = cleanEnv(process.env.DATABASE_URL);
  const databaseUrl = databasePrivateUrl || databasePublicUrl;
  const dbUrlSource = databasePrivateUrl ? "DATABASE_PRIVATE_URL" : databasePublicUrl ? "DATABASE_URL" : null;
  const dbTarget = (() => {
    if (!databaseUrl) return null;
    try {
      const parsed = new URL(databaseUrl);
      return {
        host: parsed.hostname || null,
        port: parsed.port || null,
        database: parsed.pathname?.replace(/^\/+/, "") || null,
        sslmode: parsed.searchParams.get("sslmode")
      };
    } catch {
      return { parseError: "invalid_database_url_format" };
    }
  })();

  return {
    ok: missing.length === 0,
    missing,
    diagnostics: {
      envStatus,
      config: {
        appBaseUrl,
        appBaseUrlSource: appBaseUrlFromEnv ? "env" : "code_default",
        expectedGoogleRedirectUriFromEnv: `${appBaseUrl}/api/auth/google/callback`,
        expectedGoogleRedirectUriFromRequest: requestBaseUrl
          ? `${requestBaseUrl}/api/auth/google/callback`
          : null,
        dbUrlSource,
        dbTarget
      },
      request: request
        ? {
            path: request.nextUrl.pathname,
            host: request.headers.get("host"),
            forwardedHost: request.headers.get("x-forwarded-host"),
            forwardedProto: request.headers.get("x-forwarded-proto")
          }
        : null,
      runtime: {
        nodeEnv: process.env.NODE_ENV ?? null,
        nodeVersion: process.version ?? null,
        cwd: process.cwd(),
        dbRuntime: "kysely-pg"
      }
    }
  };
}

export async function getDatabaseDiagnostics() {
  const databaseUrl = cleanEnv(process.env.DATABASE_PRIVATE_URL) || cleanEnv(process.env.DATABASE_URL);
  if (!databaseUrl) {
    return {
      ok: false,
      skipped: true,
      detail: "db_env_missing"
    };
  }

  try {
    await db.$queryRawUnsafe("SELECT 1");
    return {
      ok: true,
      skipped: false,
      detail: "db_ok"
    };
  } catch (error) {
    const err = error as { message?: string; name?: string };
    return {
      ok: false,
      skipped: false,
      detail: classifyDatabaseError(error),
      errorName: err?.name ?? "UnknownError",
      message: String(err?.message ?? "").slice(0, 1000)
    };
  }
}
