import { redirect } from "next/navigation";

import { SignInButton } from "@/components/auth-buttons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/timesheet");
  }

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-4 lg:grid-cols-5 lg:gap-6">
      <Card className="order-2 border-primary/20 bg-card/95 shadow-lg lg:order-1 lg:col-span-3">
        <CardHeader className="space-y-3">
          <span className="inline-flex w-fit items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            Time Tracking Workspace
          </span>
          <CardTitle className="text-2xl leading-tight sm:text-3xl">Track daily hours, review weekly totals, and close payroll faster.</CardTitle>
          <CardDescription className="max-w-2xl text-base">
            This tool gives each team member one place to log hours, fix missing days, and see worked vs expected time for any selected period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Daily capture</p>
              <p className="mt-1 text-sm font-medium text-foreground">Add hours per day with clear session history.</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Range visibility</p>
              <p className="mt-1 text-sm font-medium text-foreground">View current week by default or pick custom dates.</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Export ready</p>
              <p className="mt-1 text-sm font-medium text-foreground">Get payroll CSV output with the selected date range.</p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-background p-4">
            <p className="text-sm font-semibold text-foreground">How it works</p>
            <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>1. Sign in with your Google account.</li>
              <li>2. Open timesheet and add or review daily hours.</li>
              <li>3. Check overview totals for worked, expected, and variance.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card className="order-1 border-primary/20 bg-card/95 shadow-lg lg:order-2 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Welcome back</CardTitle>
          <CardDescription>Continue with Google to access your workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SignInButton />
          <p className="text-xs text-muted-foreground">
            By continuing, you will create or access your account and keep your session active for future visits.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
