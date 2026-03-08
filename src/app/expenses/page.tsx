import { redirect } from "next/navigation";

import { ExpenseBoard } from "@/components/expense-board";
import { AppNav } from "@/components/nav";
import { auth } from "@/lib/auth";

export default async function ExpensesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="space-y-5">
      <AppNav role={session.user.role} user={session.user} />
      <ExpenseBoard />
    </div>
  );
}
