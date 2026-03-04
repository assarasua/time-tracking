import { redirect } from "next/navigation";

import { ClockCard } from "@/components/clock-card";
import { AppNav } from "@/components/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="space-y-5">
      <AppNav role={session.user.role} />
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle>Welcome, {session.user.name ?? session.user.email}</CardTitle>
          <CardDescription>Track daily sessions and monitor weekly worked hours.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-1 w-20 rounded-full bg-primary" />
        </CardContent>
      </Card>
      <ClockCard />
    </div>
  );
}
