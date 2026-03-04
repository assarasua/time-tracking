"use client";

import { signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignInButton() {
  return (
    <Button
      type="button"
      className="w-full"
      onClick={() => {
        void signIn("google", { callbackUrl: "/dashboard" });
      }}
    >
        Sign in with Google
    </Button>
  );
}

export function SignOutButton() {
  return (
    <Button
      variant="secondary"
      type="button"
      onClick={() => {
        void signOut({ callbackUrl: "/login" });
      }}
    >
        Sign out
    </Button>
  );
}
