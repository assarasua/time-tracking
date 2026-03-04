import { NextRequest } from "next/server";

import { getAppBaseUrl, getAuthTrustHost } from "@/lib/app-config";
import { cleanEnv } from "@/lib/env-utils";

export function getRequestBaseUrl(request: NextRequest) {
  if (getAuthTrustHost()) {
    const forwardedHost = cleanEnv(request.headers.get("x-forwarded-host"));
    const forwardedProto = cleanEnv(request.headers.get("x-forwarded-proto"));

    if (forwardedHost && forwardedProto) {
      return `${forwardedProto}://${forwardedHost}`;
    }
  }

  const parsed = new URL(request.url);
  if (parsed.protocol && parsed.host) {
    return `${parsed.protocol}//${parsed.host}`;
  }

  return getAppBaseUrl();
}

export function isRequestSecure(request: NextRequest) {
  return getRequestBaseUrl(request).startsWith("https://");
}
