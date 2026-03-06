import { redirect } from "next/navigation";

import { AppNav } from "@/components/nav";
import { TimeOffBoard } from "@/components/time-off-board";
import { auth } from "@/lib/auth";

export default async function TimeOffPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="space-y-5">
      <AppNav role={session.user.role} user={session.user} />
      <TimeOffBoard />
    </div>
  );
}
