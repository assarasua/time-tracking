import { NextRequest, NextResponse } from "next/server";

import { isRequestSecure } from "@/lib/request-url";
import { revokeAppSessionByToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

async function logout(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  await revokeAppSessionByToken(token);

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isRequestSecure(request),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}

export async function POST(request: NextRequest) {
  return logout(request);
}

export async function GET(request: NextRequest) {
  return logout(request);
}
