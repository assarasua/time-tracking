import { NextRequest, NextResponse } from "next/server";

import { getAuthDiagnostics, getDatabaseDiagnostics } from "@/lib/auth/diagnostics";

export async function GET(request: NextRequest) {
  const payload = getAuthDiagnostics(request);
  const db = await getDatabaseDiagnostics();
  const status = payload.ok && db.ok ? 200 : 500;

  return NextResponse.json(
    {
      ...payload,
      db
    },
    { status }
  );
}
