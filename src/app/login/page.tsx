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
    <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:gap-6">
      <section className="order-2 space-y-4 lg:order-1">
        <Card className="overflow-hidden border-primary/20 bg-card/95 shadow-lg">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(78,113,50,0.2),_transparent_45%),linear-gradient(135deg,rgba(231,244,224,0.85),rgba(255,255,255,0.95))]">
            <CardHeader className="space-y-4 pb-4">
              <span className="inline-flex w-fit items-center rounded-full border border-primary/10 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Hutech HR Hub
              </span>
              <div className="space-y-3">
                <CardTitle className="max-w-4xl text-3xl leading-tight sm:text-4xl lg:text-5xl">
                  One place for hours, time off, invoices, and goals.
                </CardTitle>
                <CardDescription className="max-w-3xl text-base leading-7 text-foreground/75 sm:text-lg">
                  Track work, plan time off, upload monthly invoices, and follow quarterly goals in one workspace.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pb-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border bg-white/80 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Timesheet</p>
                  <p className="mt-2 text-sm font-medium text-foreground">Clock in and out, add manual hours, and review worked versus expected time.</p>
                </div>
                <div className="rounded-xl border border-border bg-white/80 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Time off</p>
                  <p className="mt-2 text-sm font-medium text-foreground">Plan vacation, unpaid leave, and non-working days with a clear calendar workflow.</p>
                </div>
                <div className="rounded-xl border border-border bg-white/80 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoices</p>
                  <p className="mt-2 text-sm font-medium text-foreground">Upload one PDF invoice per month and keep finance review centralized and auditable.</p>
                </div>
                <div className="rounded-xl border border-border bg-white/80 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Goals</p>
                  <p className="mt-2 text-sm font-medium text-foreground">Track quarterly KPIs, mark achievements, and keep evaluations visible to each employee.</p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background/90 p-5">
                <p className="text-sm font-semibold text-foreground">What you can do</p>
                <ul className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <li className="rounded-lg border border-border bg-card px-4 py-3">Log hours with a live timer or add them manually.</li>
                  <li className="rounded-lg border border-border bg-card px-4 py-3">Plan future time off and sync it to Google Calendar.</li>
                  <li className="rounded-lg border border-border bg-card px-4 py-3">Upload one PDF invoice per month and keep it in one place.</li>
                  <li className="rounded-lg border border-border bg-card px-4 py-3">Follow quarterly goals and see final evaluations clearly.</li>
                </ul>
              </div>
            </CardContent>
          </div>
        </Card>
      </section>

      <aside className="order-1 lg:order-2">
        <Card className="border-primary/20 bg-card/95 shadow-lg lg:sticky lg:top-8">
          <CardHeader className="space-y-3">
            <span className="inline-flex w-fit items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              Secure company access
            </span>
            <CardTitle className="text-2xl">Enter your workspace</CardTitle>
            <CardDescription className="text-sm leading-6">
              Continue with Google to open your workspace and pick up where you left off.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Inside after sign-in</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Timesheet is your default landing page.</li>
                <li>Your timezone, calendar sync, and profile stay available from the top bar.</li>
                <li>Your saved tools and data stay available in one place.</li>
              </ul>
            </div>
            <SignInButton />
            <p className="text-xs leading-5 text-muted-foreground">
              By continuing, your account is created or restored automatically and your session stays active for future visits.
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
