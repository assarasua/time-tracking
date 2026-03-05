import { redirect } from "next/navigation";

import { ClockCard } from "@/components/clock-card";
import { DateRangePresetHeader } from "@/components/date-range-preset-header";
import { AppNav } from "@/components/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { DATE_RE, getCurrentWeekRange, normalizeRange } from "@/lib/date-range";

type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const fallback = getCurrentWeekRange(1);
  const selected = DATE_RE.test(params.from ?? "") || DATE_RE.test(params.to ?? "")
    ? normalizeRange(params.from ?? fallback.from, params.to ?? fallback.to)
    : fallback;
  const selectedFrom = selected.from;
  const selectedTo = selected.to;
  return (
    <div className="space-y-4 sm:space-y-5">
      <AppNav role={session.user.role} user={session.user} />
      <Card className="border-primary/20 bg-card/95 shadow-sm">
        <CardHeader className="space-y-2 pb-3 sm:pb-4">
          <CardTitle className="text-xl sm:text-2xl">Welcome, {session.user.name ?? session.user.email}</CardTitle>
          <CardDescription>Review totals fast and drill into details using the selected period.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-1 sm:pt-0">
          <DateRangePresetHeader
            initialFrom={selectedFrom}
            initialTo={selectedTo}
            weekStartsOn={1}
            className="mt-1 sm:mt-0"
          />
        </CardContent>
      </Card>
      <ClockCard from={selectedFrom} to={selectedTo} />
    </div>
  );
}
