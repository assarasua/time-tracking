import { redirect } from "next/navigation";

import { AppNav } from "@/components/nav";
import { TimesheetBoard } from "@/components/timesheet-board";
import { auth } from "@/lib/auth";
import { DATE_RE, getCurrentWeekRange, normalizeRange } from "@/lib/date-range";

type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function TimesheetPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const fallback = getCurrentWeekRange(1);
  const selected = DATE_RE.test(params.from ?? "") || DATE_RE.test(params.to ?? "")
    ? normalizeRange(params.from ?? fallback.from, params.to ?? fallback.to)
    : fallback;
  const initialFrom = selected.from;
  const initialTo = selected.to;

  return (
    <div className="space-y-5">
      <AppNav role={session.user.role} user={session.user} />
      <TimesheetBoard role={session.user.role} initialFrom={initialFrom} initialTo={initialTo} />
    </div>
  );
}
