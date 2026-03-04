"use client";

import { Button } from "@/components/ui/button";

export function SignInButton() {
  return (
    <Button
      type="button"
      className="w-full"
      onClick={() => {
        window.location.href = "/api/auth/google/start";
      }}
    >
      Sign in with Google
    </Button>
  );
}

export function SignOutButton() {
  return (
    <form method="post" action="/api/auth/logout">
      <Button variant="secondary" type="submit">
        Sign out
      </Button>
    </form>
  );
}
