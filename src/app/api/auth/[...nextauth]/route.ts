import { handlers } from "@/lib/auth";
import { NextResponse } from "next/server";

const requiredAuthEnv = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AUTH_SECRET", "APP_BASE_URL"] as const;

function getMissingAuthEnv() {
  return requiredAuthEnv.filter((key) => !process.env[key]);
}

export async function GET(request: Request, context: { params: Promise<Record<string, string>> }) {
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

  return handlers.GET(request, context);
}

export async function POST(request: Request, context: { params: Promise<Record<string, string>> }) {
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

  return handlers.POST(request, context);
}
