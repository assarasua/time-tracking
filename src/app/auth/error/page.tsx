import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SearchParams = Promise<{ error?: string }>;

const errorCopy: Record<string, { title: string; description: string }> = {
  AccessDenied: {
    title: "Sign-in Was Blocked",
    description: "Your sign-in was blocked by auth policy or profile validation. Try again or use a different Google account."
  },
  Configuration: {
    title: "Authentication Configuration Error",
    description: "The server auth provider settings are not valid at runtime. Contact support if this persists."
  },
  OAuthSignin: {
    title: "Google Sign-in Start Failed",
    description: "The app could not initialize Google OAuth. Please retry in a few seconds."
  },
  OAuthCallback: {
    title: "Google Callback Failed",
    description: "Google returned an invalid callback response. Please retry sign-in."
  },
  default: {
    title: "Unable To Sign In",
    description: "An unexpected authentication error occurred. Please retry sign-in."
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
