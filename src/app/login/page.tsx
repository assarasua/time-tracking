import { redirect } from "next/navigation";
import Link from "next/link";

import { SignInButton } from "@/components/auth-buttons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Time Tracking</CardTitle>
          <CardDescription>
            Continue with Google to sign up or sign in automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SignInButton />
          <p className="text-xs text-muted-foreground">
            New users are provisioned automatically. First successful user becomes admin.
          </p>
          <Link href="/auth/diagnostics" className="block text-xs font-medium text-primary hover:underline">
            Check local auth diagnostics
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
