import { NextRequest, NextResponse } from "next/server";

import { getAuthDiagnostics } from "@/lib/auth/diagnostics";

export async function GET(request: NextRequest) {
  const payload = getAuthDiagnostics(request);
  const status = payload.ok ? 200 : 500;

  return NextResponse.json(payload, { status });
}

