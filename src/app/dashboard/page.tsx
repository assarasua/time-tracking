import { redirect } from "next/navigation";

import { AppNav } from "@/components/nav";
import { ClockCard } from "@/components/clock-card";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="stack">
      <AppNav role={session.user.role} />
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Welcome, {session.user.name ?? session.user.email}</h2>
        <p style={{ marginBottom: 0 }}>Track daily sessions and monitor weekly worked hours.</p>
      </div>
      <ClockCard />
    </div>
  );
}
