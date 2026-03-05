import { NextRequest } from "next/server";

import { getAppBaseUrl } from "@/lib/app-config";
import { db } from "@/lib/db";
import { cleanEnv } from "@/lib/env-utils";
import { getRequestBaseUrl } from "@/lib/request-url";

const REQUIRED_AUTH_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_SECRET",
  "DATABASE_URL"
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
          : null
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
        nodeEnv: process.env.NODE_ENV ?? null
      }
    }
  };
}

function classifyDbError(error: unknown) {
  const err = error as { message?: string; name?: string; code?: string };
  const message = String(err?.message ?? "").toLowerCase();
  const prismaCode = typeof err?.code === "string" ? err.code : null;

  if (err?.name?.includes("PrismaClientInitializationError")) {
    if (
      message.includes("could not locate the query engine") ||
      message.includes("libquery_engine")
    ) {
      return "db_engine_missing";
    }
    if (message.includes("unable to run in this browser environment") || message.includes("edge runtime")) {
      return "db_runtime_unsupported";
    }
    if (message.includes("can't reach database server")) {
      return "db_unreachable";
    }
    if (message.includes("authentication failed")) {
      return "db_auth_failed";
    }
    if (message.includes("ssl")) {
      return "db_ssl_error";
    }
    return "db_initialization_failed";
  }

  if (prismaCode === "P2021") return "db_schema_missing";
  if (prismaCode) return `prisma_${prismaCode.toLowerCase()}`;
  return "db_unknown";
}

export async function getDatabaseDiagnostics() {
  const databaseUrl = cleanEnv(process.env.DATABASE_URL);
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
      detail: classifyDbError(error),
      errorName: err?.name ?? "UnknownError",
      message: String(err?.message ?? "").slice(0, 240)
    };
  }
}
