import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SearchParams = Promise<{ error?: string }>;

const errorCopy: Record<string, { title: string; description: string }> = {
  oauth_state_invalid: {
    title: "Session Verification Failed",
    description: "Your login state could not be verified. Please retry sign in from the login page."
  },
  oauth_exchange_failed: {
    title: "Google Token Exchange Failed",
    description: "The server could not complete OAuth token exchange with Google. Please try again."
  },
  profile_missing_email: {
    title: "Google Profile Missing Email",
    description: "Your Google profile did not include a verified email, so account creation could not continue."
  },
  session_create_failed: {
    title: "Session Creation Failed",
    description: "Your account was authenticated, but app session creation failed. Please retry."
  },
  oauth_provider_misconfigured: {
    title: "Google OAuth Misconfigured",
    description: "Google OAuth credentials or callback configuration are invalid at runtime."
  },
  default: {
    title: "Unable To Sign In",
    description: "An unexpected authentication error occurred. Please retry sign in."
  }
};

export default async function AuthErrorPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const errorKey = params.error ?? "default";
  const copy = errorCopy[errorKey] ?? errorCopy.default;

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-lg border-destructive/25 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Error code: <span className="font-mono text-foreground">{errorKey}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-nav-selected"
            >
              Try sign in again
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Go home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
