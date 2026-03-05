import { NextRequest, NextResponse } from "next/server";

import { exchangeGoogleCodeForAccessToken, fetchGoogleProfile, verifySignedOAuthState } from "@/lib/auth/google";
import { provisionUserFromGoogleProfile } from "@/lib/auth/provision";
import { classifyDatabaseError } from "@/lib/auth/db-error";
import {
  createAppSession,
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS
} from "@/lib/auth/session";
import { getRequestBaseUrl, isRequestSecure } from "@/lib/request-url";

function errorRedirect(request: NextRequest, errorCode: string) {
  return NextResponse.redirect(new URL(`/auth/error?error=${errorCode}`, getRequestBaseUrl(request)));
}

function classifyAuthError(error: unknown) {
  const err = error as { message?: string; code?: string; name?: string };
  const message = String(err?.message ?? "");
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

  const isLikelyDatabaseError =
    Boolean(prismaCode) ||
    String(err?.name ?? "").includes("Prisma") ||
    message.toLowerCase().includes("database") ||
    message.toLowerCase().includes("query engine");

  if (isLikelyDatabaseError) {
    return { code: "session_create_failed", detail: classifyDatabaseError(error) };
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

    const response = NextResponse.redirect(new URL("/dashboard", getRequestBaseUrl(request)));
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
      new URL(`/auth/error?error=${classified.code}&detail=${classified.detail}`, getRequestBaseUrl(request))
    );
  }
}
