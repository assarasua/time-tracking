import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error") ?? "default";
  return NextResponse.redirect(new URL(`/auth/error?error=${error}`, request.url));
}
