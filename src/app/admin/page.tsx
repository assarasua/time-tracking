import { Role } from "@prisma/client";
import { formatISO } from "date-fns";
import { redirect } from "next/navigation";

import { InviteForm } from "@/components/invite-form";
import { AppNav } from "@/components/nav";
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
    <div className="stack">
      <AppNav role={session.user.role} />

      <div className="grid-two">
        <div className="card">
          <InviteForm />
        </div>

        <div className="card stack">
          <h3 style={{ margin: 0 }}>People</h3>
          {members.map((member) => (
            <div key={member.id} className="row" style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
              <div>
                <div>{member.user.name ?? member.user.email}</div>
                <small>{member.user.email}</small>
              </div>
              <div>
                <small>{member.role}</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Recent locked weeks</h3>
        {locks.length === 0 ? <small>No locked weeks yet.</small> : null}
        {locks.map((lock) => (
          <div key={lock.id} className="row" style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            <span>{formatISO(lock.weekStart, { representation: "date" })}</span>
            <span>{lock.autoLocked ? "Auto" : "Manual"}</span>
          </div>
        ))}
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Exports</h3>
        <p style={{ margin: 0 }}>Use API endpoint `/api/exports/payroll.csv?from=YYYY-MM-DD&to=YYYY-MM-DD` to download payroll CSV.</p>
      </div>
    </div>
  );
}
