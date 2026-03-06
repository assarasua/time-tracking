import { redirect } from "next/navigation";

import { ClockCard } from "@/components/clock-card";
import { AppNav } from "@/components/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

import { getCurrentWeekRange } from "@/lib/date-range";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const selected = getCurrentWeekRange(1);
  return (
    <div className="space-y-4 sm:space-y-5">
      <AppNav role={session.user.role} user={session.user} />
      <Card className="border-primary/20 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2 pb-3 sm:pb-4">
          <CardTitle className="text-xl sm:text-2xl">Welcome, {session.user.name ?? session.user.email}</CardTitle>
          <CardDescription>Review the current week at a glance, including planned days off and public holidays.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-1 sm:pt-0">
          <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
            <p className="font-semibold text-foreground">Summary of Current Week</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selected.from} to {selected.to}
            </p>
          </div>
        </CardContent>
      </Card>
      <ClockCard from={selected.from} to={selected.to} />
    </div>
  );
}
