export const DB_ERROR_DETAILS = [
  "db_env_missing",
  "db_unreachable",
  "db_auth_failed",
  "db_ssl_error",
  "db_schema_missing",
  "db_engine_missing",
  "db_runtime_unsupported",
  "db_unknown"
] as const;

export type DbErrorDetail = (typeof DB_ERROR_DETAILS)[number];

export function classifyDatabaseError(error: unknown): DbErrorDetail {
  const err = error as { message?: string; name?: string; code?: string };
  const message = String(err?.message ?? "").toLowerCase();
  const code = typeof err?.code === "string" ? err.code.toUpperCase() : "";
  const name = String(err?.name ?? "");

  if (code === "P2021" || code === "42P01") return "db_schema_missing";
  if (code === "P1000" || code === "28P01") return "db_auth_failed";
  if (code === "P1001" || code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EHOSTUNREACH")
    return "db_unreachable";
  if (code === "P1011" || code === "SELF_SIGNED_CERT_IN_CHAIN") return "db_ssl_error";
  if (code === "ENOENT") return "db_engine_missing";

  if (
    message.includes("could not locate the query engine") ||
    message.includes("libquery_engine") ||
    message.includes("query_compiler_bg.wasm") ||
    message.includes("no such file or directory, readall")
  ) {
    return "db_engine_missing";
  }

  if (message.includes("unable to run in this browser environment") || message.includes("edge runtime")) {
    return "db_runtime_unsupported";
  }

  if (message.includes("can't reach database server") || message.includes("database not reachable")) {
    return "db_unreachable";
  }

  if (message.includes("authentication failed") || message.includes("database access denied")) {
    return "db_auth_failed";
  }

  if (message.includes("tls connection error") || message.includes("ssl")) {
    return "db_ssl_error";
  }

  if (name.includes("PrismaClientInitializationError") || name.includes("PrismaClientKnownRequestError")) {
    return "db_unknown";
  }

  return "db_unknown";
}
