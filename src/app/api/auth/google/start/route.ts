import { NextRequest, NextResponse } from "next/server";

import { buildGoogleAuthorizationUrl, createSignedOAuthState } from "@/lib/auth/google";
import { OAUTH_STATE_COOKIE_NAME } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const state = createSignedOAuthState();
    const url = buildGoogleAuthorizationUrl(state);
    const response = NextResponse.redirect(url);

    response.cookies.set({
      name: OAUTH_STATE_COOKIE_NAME,
      value: state,
      httpOnly: true,
      secure: true,
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
