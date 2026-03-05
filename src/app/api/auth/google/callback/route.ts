import { NextRequest, NextResponse } from "next/server";

import { exchangeGoogleCodeForAccessToken, fetchGoogleProfile, verifySignedOAuthState } from "@/lib/auth/google";
import { provisionUserFromGoogleProfile } from "@/lib/auth/provision";
import {
  createAppSession,
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS
} from "@/lib/auth/session";
import { getRequestBaseUrl, isRequestSecure } from "@/lib/request-url";

function errorRedirect(request: NextRequest, errorCode: string) {
  return NextResponse.redirect(new URL(`/auth/error?error=${errorCode}`, request.url));
}

function classifyAuthError(error: unknown) {
  const err = error as { message?: string; code?: string; name?: string };
  const message = String(err?.message ?? "");
  const normalizedMessage = message.toLowerCase();
  const prismaCode = typeof err?.code === "string" ? err.code : undefined;

  if (message.includes("Google token exchange failed")) {
    return { code: "oauth_exchange_failed", detail: "google_token_exchange_failed" };
  }
  if (
    message.includes("Google profile is missing required sub/email fields") ||
    message.includes("Google profile email is not verified")
  ) {
    return { code: "profile_missing_email", detail: "google_profile_invalid" };
  }
  if (err?.name?.includes("PrismaClientInitializationError")) {
    if (
      normalizedMessage.includes("could not locate the query engine") ||
      normalizedMessage.includes("libquery_engine")
    ) {
      return { code: "session_create_failed", detail: "db_engine_missing" };
    }
    if (
      normalizedMessage.includes("unable to run in this browser environment") ||
      normalizedMessage.includes("edge runtime")
    ) {
      return { code: "session_create_failed", detail: "db_runtime_unsupported" };
    }
    if (normalizedMessage.includes("can't reach database server")) {
      return { code: "session_create_failed", detail: "db_unreachable" };
    }
    if (normalizedMessage.includes("authentication failed")) {
      return { code: "session_create_failed", detail: "db_auth_failed" };
    }
    if (normalizedMessage.includes("ssl")) {
      return { code: "session_create_failed", detail: "db_ssl_error" };
    }
    return { code: "session_create_failed", detail: "db_initialization_failed" };
  }
  if (prismaCode === "P2021") {
    return { code: "session_create_failed", detail: "db_schema_missing" };
  }
  if (prismaCode) {
    return { code: "session_create_failed", detail: `prisma_${prismaCode.toLowerCase()}` };
  }

  return { code: "session_create_failed", detail: "unknown" };
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;

  if (!state || !cookieState || state !== cookieState || !verifySignedOAuthState(state)) {
    return errorRedirect(request, "oauth_state_invalid");
  }

  if (!code) {
    return errorRedirect(request, "oauth_exchange_failed");
  }

  try {
    const callbackUrl = `${getRequestBaseUrl(request)}/api/auth/google/callback`;
    const secureCookie = isRequestSecure(request);
    const accessToken = await exchangeGoogleCodeForAccessToken(code, callbackUrl);
    const profile = await fetchGoogleProfile(accessToken);

    if (!profile.email) {
      return errorRedirect(request, "profile_missing_email");
    }

    const { user, membership } = await provisionUserFromGoogleProfile(profile);
    const appSession = await createAppSession({
      userId: user.id,
      organizationId: membership.organizationId
    });

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: appSession.token,
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS
    });
    response.cookies.set({
      name: OAUTH_STATE_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });

    return response;
  } catch (error) {
    const classified = classifyAuthError(error);
    console.error("auth.google.callback.failed", {
      errorCode: classified.code,
      errorDetail: classified.detail,
      error
    });
    return NextResponse.redirect(
      new URL(`/auth/error?error=${classified.code}&detail=${classified.detail}`, request.url)
    );
  }
}
