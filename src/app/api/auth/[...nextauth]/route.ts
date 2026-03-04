import { handlers } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/app-config";
import { NextRequest, NextResponse } from "next/server";

const requiredAuthEnv = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AUTH_SECRET"] as const;

function getMissingAuthEnv() {
  return requiredAuthEnv.filter((key) => {
    const value = process.env[key];
    return !value || value.trim().length === 0;
  });
}

type AuthRouteContext = { params: Promise<{ nextauth: string[] }> };

function getRequestBaseUrl(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  return `${proto}://${host}`;
}

function getDiagnosticContext(request: NextRequest) {
  const envStatus = Object.fromEntries(
    requiredAuthEnv.map((key) => {
      const value = process.env[key];
      return [
        key,
        {
          present: Boolean(value),
          length: value?.length ?? 0
        }
      ];
    })
  );

  return {
    envStatus,
    appBaseUrlEffective: getAppBaseUrl(),
    appBaseUrlSource: process.env.APP_BASE_URL?.trim() ? "env" : "default",
    authTrustHostEffective: process.env.AUTH_TRUST_HOST?.trim() ? process.env.AUTH_TRUST_HOST : "true (default)",
    request: {
      path: request.nextUrl.pathname,
      host: request.headers.get("host"),
      forwardedHost: request.headers.get("x-forwarded-host"),
      forwardedProto: request.headers.get("x-forwarded-proto")
    },
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? null,
      railwayEnv: process.env.RAILWAY_ENVIRONMENT_NAME ?? null,
      railwayService: process.env.RAILWAY_SERVICE_NAME ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null
    }
  };
}

function validateAuthRequest(request: NextRequest) {
  const missing = getMissingAuthEnv();
  if (missing.length > 0) {
    return NextResponse.json({
      ok: false,
      code: "missing_env",
      error: "Auth configuration is incomplete.",
      missing,
      diagnostics: getDiagnosticContext(request)
    }, { status: 500 });
  }

  try {
    const expected = new URL(getAppBaseUrl());
    const actualBase = getRequestBaseUrl(request);
    if (!actualBase) {
      return NextResponse.json({
        ok: false,
        code: "missing_host_header",
        error: "Cannot determine request host headers for auth callback validation.",
        diagnostics: getDiagnosticContext(request)
      }, { status: 500 });
    }

    const actual = new URL(actualBase);
    if (expected.host !== actual.host) {
      return NextResponse.json({
        ok: false,
        code: "host_mismatch",
        error: "APP_BASE_URL host does not match incoming request host.",
        expectedHost: expected.host,
        actualHost: actual.host,
        diagnostics: getDiagnosticContext(request)
      }, { status: 500 });
    }
  } catch {
    return NextResponse.json({
      ok: false,
      code: "invalid_app_base_url",
      error: "APP_BASE_URL is not a valid URL.",
      diagnostics: getDiagnosticContext(request)
    }, { status: 500 });
  }

  return null;
}

function handleAuthException(error: unknown, request: NextRequest) {
  const details =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: "Unknown auth handler error" };

  console.error("Auth handler exception", {
    details,
    path: request.nextUrl.pathname,
    method: request.method
  });

  return NextResponse.json({
    ok: false,
    code: "handler_exception",
    error: "Auth handler failed. Check server logs for stack trace.",
    details,
    diagnostics: getDiagnosticContext(request)
  }, { status: 500 });
}

function maybeReturnConfigurationDiagnostics(request: NextRequest, response: Response) {
  const location = response.headers.get("location");
  if (!location || !location.includes("error=Configuration")) {
    return null;
  }

  if (!request.nextUrl.pathname.includes("/api/auth/signin/google")) {
    return null;
  }

  return NextResponse.json({
    ok: false,
    code: "auth_configuration_error",
    error: "NextAuth returned Configuration during Google sign-in.",
    hints: [
      "Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set on the serving platform runtime.",
      "Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET have no leading/trailing spaces.",
      "Confirm Google OAuth redirect URI includes https://time-tracking.hutech.tech/api/auth/callback/google."
    ],
    diagnostics: getDiagnosticContext(request)
  }, { status: 500 });
}

export async function GET(request: NextRequest, _context: AuthRouteContext) {
  const validationError = validateAuthRequest(request);
  if (validationError) {
    return validationError;
  }

  try {
    const response = await handlers.GET(request);
    const diagnostics = maybeReturnConfigurationDiagnostics(request, response);
    if (diagnostics) {
      return diagnostics;
    }
    return response;
  } catch (error) {
    return handleAuthException(error, request);
  }
}

export async function POST(request: NextRequest, _context: AuthRouteContext) {
  const validationError = validateAuthRequest(request);
  if (validationError) {
    return validationError;
  }

  try {
    return handlers.POST(request);
  } catch (error) {
    return handleAuthException(error, request);
  }
}
