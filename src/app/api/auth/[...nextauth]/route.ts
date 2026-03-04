import { handlers } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const requiredAuthEnv = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AUTH_SECRET", "APP_BASE_URL"] as const;

function getMissingAuthEnv() {
  return requiredAuthEnv.filter((key) => !process.env[key]);
}

type AuthRouteContext = { params: Promise<{ nextauth: string[] }> };

function getRequestBaseUrl(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  return `${proto}://${host}`;
}

function validateAuthRequest(request: NextRequest) {
  const missing = getMissingAuthEnv();
  if (missing.length > 0) {
    return NextResponse.json({
      ok: false,
      code: "missing_env",
      error: "Auth configuration is incomplete.",
      missing
    }, { status: 500 });
  }

  try {
    const expected = new URL(process.env.APP_BASE_URL as string);
    const actualBase = getRequestBaseUrl(request);
    if (!actualBase) {
      return NextResponse.json({
        ok: false,
        code: "missing_host_header",
        error: "Cannot determine request host headers for auth callback validation."
      }, { status: 500 });
    }

    const actual = new URL(actualBase);
    if (expected.host !== actual.host) {
      return NextResponse.json({
        ok: false,
        code: "host_mismatch",
        error: "APP_BASE_URL host does not match incoming request host.",
        expectedHost: expected.host,
        actualHost: actual.host
      }, { status: 500 });
    }
  } catch {
    return NextResponse.json({
      ok: false,
      code: "invalid_app_base_url",
      error: "APP_BASE_URL is not a valid URL."
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
    details
  }, { status: 500 });
}

export async function GET(request: NextRequest, _context: AuthRouteContext) {
  const validationError = validateAuthRequest(request);
  if (validationError) {
    return validationError;
  }

  try {
    return handlers.GET(request);
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
