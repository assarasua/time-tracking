import { NextResponse } from "next/server";

export const SUMMARY_CACHE_CONTROL = "private, max-age=0, s-maxage=30, stale-while-revalidate=30";

export function withSummaryCache(response: NextResponse) {
  response.headers.set("Cache-Control", SUMMARY_CACHE_CONTROL);
  return response;
}
