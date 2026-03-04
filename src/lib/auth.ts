import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { getAppSessionFromToken, type AppSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function auth(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getAppSessionFromToken(token);
}

export async function authFromRequest(request: NextRequest): Promise<AppSession | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return getAppSessionFromToken(token);
}
