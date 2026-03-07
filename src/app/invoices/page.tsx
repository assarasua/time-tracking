import { redirect } from "next/navigation";

import { InvoiceBoard } from "@/components/invoice-board";
import { AppNav } from "@/components/nav";
import { auth } from "@/lib/auth";

export default async function InvoicesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="space-y-5">
      <AppNav role={session.user.role} user={session.user} />
      <InvoiceBoard />
    </div>
  );
}
