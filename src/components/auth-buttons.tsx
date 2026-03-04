import { signIn, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function SignInButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/dashboard" });
      }}
      className="w-full"
    >
      <Button type="submit" className="w-full">
        Sign in with Google
      </Button>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <Button variant="secondary" type="submit">
        Sign out
      </Button>
    </form>
  );
}
