import { NextRequest, NextResponse } from "next/server";

import { authFromRequest } from "@/lib/auth";
import { verifySignedOAuthState } from "@/lib/auth/google";
import {
  completeGoogleCalendarConnection,
  GOOGLE_CALENDAR_OAUTH_STATE_COOKIE_NAME
} from "@/lib/google-calendar";
import { getRequestBaseUrl, isRequestSecure } from "@/lib/request-url";

export async function GET(request: NextRequest) {
  const session = await authFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", getRequestBaseUrl(request)));
  }

  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const cookieState = request.cookies.get(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE_NAME)?.value;

  if (!state || !cookieState || state !== cookieState || !verifySignedOAuthState(state)) {
    return NextResponse.redirect(new URL("/time-off?calendar_sync=oauth_state_invalid", getRequestBaseUrl(request)));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/time-off?calendar_sync=oauth_exchange_failed", getRequestBaseUrl(request)));
  }

  try {
    const callbackUrl = `${getRequestBaseUrl(request)}/api/integrations/google-calendar/callback`;
    await completeGoogleCalendarConnection({
      userId: session.user.id,
      code,
      redirectUri: callbackUrl
    });

    const response = NextResponse.redirect(new URL("/time-off?calendar_sync=connected", getRequestBaseUrl(request)));
    response.cookies.set({
      name: GOOGLE_CALENDAR_OAUTH_STATE_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: isRequestSecure(request),
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });
    return response;
  } catch (error) {
    console.error("integrations.googleCalendar.callback.failed", { error });
    return NextResponse.redirect(new URL("/time-off?calendar_sync=connection_failed", getRequestBaseUrl(request)));
  }
}
