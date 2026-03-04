import { NextRequest, NextResponse } from "next/server";

import { exchangeGoogleCodeForAccessToken, fetchGoogleProfile, verifySignedOAuthState } from "@/lib/auth/google";
import { provisionUserFromGoogleProfile } from "@/lib/auth/provision";
import {
  createAppSession,
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS
} from "@/lib/auth/session";

function errorRedirect(request: NextRequest, errorCode: string) {
  return NextResponse.redirect(new URL(`/auth/error?error=${errorCode}`, request.url));
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
    const accessToken = await exchangeGoogleCodeForAccessToken(code);
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
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS
    });
    response.cookies.set({
      name: OAUTH_STATE_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });

    return response;
  } catch (error) {
    console.error("auth.google.callback.failed", { error });
    return errorRedirect(request, "session_create_failed");
  }
}
