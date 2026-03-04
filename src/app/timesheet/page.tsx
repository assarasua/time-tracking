import { formatISO } from "date-fns";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/nav";
import { TimesheetBoard } from "@/components/timesheet-board";
import { auth } from "@/lib/auth";

type SearchParams = Promise<{ week_start?: string }>;

export default async function TimesheetPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const initialWeekStart = params.week_start ?? formatISO(new Date(), { representation: "date" });

  return (
    <div className="space-y-5">
      <AppNav role={session.user.role} />
      <TimesheetBoard role={session.user.role} initialWeekStart={initialWeekStart} />
    </div>
  );
}

