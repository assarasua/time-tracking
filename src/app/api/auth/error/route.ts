import { NextRequest, NextResponse } from "next/server";
import { getRequestBaseUrl } from "@/lib/request-url";

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error") ?? "default";
  return NextResponse.redirect(new URL(`/auth/error?error=${error}`, getRequestBaseUrl(request)));
}
