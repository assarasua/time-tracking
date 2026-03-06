import { NextRequest, NextResponse } from "next/server";

import { authFromRequest } from "@/lib/auth";
import { createSignedOAuthState } from "@/lib/auth/google";
import { GOOGLE_CALENDAR_OAUTH_STATE_COOKIE_NAME, getGoogleCalendarStartUrl } from "@/lib/google-calendar";
import { getRequestBaseUrl, isRequestSecure } from "@/lib/request-url";

export async function GET(request: NextRequest) {
  const session = await authFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", getRequestBaseUrl(request)));
  }

  try {
    const state = createSignedOAuthState();
    const callbackUrl = `${getRequestBaseUrl(request)}/api/integrations/google-calendar/callback`;
    const url = getGoogleCalendarStartUrl(state, callbackUrl);
    const response = NextResponse.redirect(url);

    response.cookies.set({
      name: GOOGLE_CALENDAR_OAUTH_STATE_COOKIE_NAME,
      value: state,
      httpOnly: true,
      secure: isRequestSecure(request),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10
    });

    return response;
  } catch (error) {
    console.error("integrations.googleCalendar.start.failed", { error });
    return NextResponse.redirect(new URL("/time-off?calendar_sync=provider_error", getRequestBaseUrl(request)));
  }
}
