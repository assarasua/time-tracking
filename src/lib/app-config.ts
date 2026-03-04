export const DEFAULT_APP_BASE_URL = "https://time-tracking.hutech.tech";

export function getAppBaseUrl() {
  const fromEnv = process.env.APP_BASE_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_APP_BASE_URL;
}

export function getAuthTrustHost() {
  const fromEnv = process.env.AUTH_TRUST_HOST?.trim().toLowerCase();
  if (!fromEnv) {
    return true;
  }
  return fromEnv === "true" || fromEnv === "1" || fromEnv === "yes";
}
