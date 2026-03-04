import { NextRequest, NextResponse } from "next/server";

import { buildGoogleAuthorizationUrl, createSignedOAuthState } from "@/lib/auth/google";
import { getRequestBaseUrl, isRequestSecure } from "@/lib/request-url";
import { OAUTH_STATE_COOKIE_NAME } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const state = createSignedOAuthState();
    const callbackUrl = `${getRequestBaseUrl(request)}/api/auth/google/callback`;
    const url = buildGoogleAuthorizationUrl(state, callbackUrl);
    const response = NextResponse.redirect(url);

    response.cookies.set({
      name: OAUTH_STATE_COOKIE_NAME,
      value: state,
      httpOnly: true,
      secure: isRequestSecure(request),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10
    });

    return response;
  } catch (error) {
    console.error("auth.google.start.failed", { error });
    return NextResponse.redirect(new URL("/auth/error?error=oauth_provider_misconfigured", request.url));
  }
}
