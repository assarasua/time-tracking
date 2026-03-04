import { Role } from "@prisma/client";
import { formatISO } from "date-fns";
import { redirect } from "next/navigation";

import { InviteForm } from "@/components/invite-form";
import { AppNav } from "@/components/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== Role.admin) {
    redirect("/dashboard");
  }

  const [members, locks] = await Promise.all([
    db.organizationUser.findMany({
      where: {
        organizationId: session.user.organizationId
      },
      include: {
        user: true
      },
      orderBy: {
        createdAt: "asc"
      }
    }),
    db.weekLock.findMany({
      where: {
        organizationId: session.user.organizationId
      },
      orderBy: {
        weekStart: "desc"
      },
      take: 6
    })
  ]);

  return (
    <div className="space-y-5">
      <AppNav role={session.user.role} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>Add employees or admins to your workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>People</CardTitle>
            <CardDescription>Active organization members and their roles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{member.user.name ?? member.user.email}</p>
                  <p className="text-xs text-muted-foreground">{member.user.email}</p>
                </div>
                <span className="rounded-full bg-success px-3 py-1 text-xs font-semibold text-success-foreground">
                  {member.role}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent locked weeks</CardTitle>
          <CardDescription>Auto and manual lock activity for payroll safety.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {locks.length === 0 ? <p className="text-sm text-muted-foreground">No locked weeks yet.</p> : null}
          {locks.map((lock) => (
            <div
              key={lock.id}
              className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-sm"
            >
              <span className="font-medium text-foreground">{formatISO(lock.weekStart, { representation: "date" })}</span>
              <span className="text-muted-foreground">{lock.autoLocked ? "Auto" : "Manual"}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exports</CardTitle>
          <CardDescription>Download payroll-ready CSV with date filters.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use API endpoint <code>/api/exports/payroll.csv?from=YYYY-MM-DD&to=YYYY-MM-DD</code> to download payroll CSV.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
