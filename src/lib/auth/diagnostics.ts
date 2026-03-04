import { NextRequest } from "next/server";

import { getAppBaseUrl } from "@/lib/app-config";
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
