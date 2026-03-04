import { handlers } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const requiredAuthEnv = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AUTH_SECRET", "APP_BASE_URL"] as const;

function getMissingAuthEnv() {
  return requiredAuthEnv.filter((key) => !process.env[key]);
}

type AuthRouteContext = { params: Promise<{ nextauth: string[] }> };

export async function GET(request: NextRequest, context: AuthRouteContext) {
  const missing = getMissingAuthEnv();
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "Auth configuration is incomplete.",
        missing
      },
      { status: 500 }
    );
  }

  return handlers.GET(request);
}

export async function POST(request: NextRequest, context: AuthRouteContext) {
  const missing = getMissingAuthEnv();
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "Auth configuration is incomplete.",
        missing
      },
      { status: 500 }
    );
  }

  return handlers.POST(request);
}
