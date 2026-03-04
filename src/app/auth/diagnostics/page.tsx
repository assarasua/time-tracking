import Link from "next/link";

import { getAuthDiagnostics } from "@/lib/auth/diagnostics";

export default function AuthDiagnosticsPage() {
  const data = getAuthDiagnostics();

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center p-4">
      <div className="w-full space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Auth Diagnostics</h1>
        <p className="text-sm text-muted-foreground">
          Use this page to verify local auth environment and expected Google callback URL.
        </p>

        <div className="rounded-md bg-muted p-3 text-sm">
          Status:{" "}
          <span className={data.ok ? "font-semibold text-green-700" : "font-semibold text-destructive"}>
            {data.ok ? "OK" : "Missing required environment variables"}
          </span>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Required Variables</h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(data.diagnostics.envStatus).map(([key, status]) => (
              <li key={key} className="flex justify-between rounded border border-border px-3 py-2">
                <span className="font-mono">{key}</span>
                <span>{status.present ? "present" : "missing"}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1 text-sm">
          <p>
            Expected redirect URI (from APP_BASE_URL):{" "}
            <span className="font-mono">{data.diagnostics.config.expectedGoogleRedirectUriFromEnv}</span>
          </p>
          {data.missing.length > 0 ? (
            <p className="text-destructive">Missing: {data.missing.join(", ")}</p>
          ) : null}
        </div>

        <div className="flex gap-3">
          <Link
            href="/api/auth/diagnostics"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold"
          >
            Open JSON diagnostics
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

