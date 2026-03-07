import { redirect } from "next/navigation";

import { GoalsBoard } from "@/components/goals-board";
import { AppNav } from "@/components/nav";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function GoalsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [membership, adminMembers] = await Promise.all([
    db.organizationUser.findFirst({
      where: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        active: true
      },
      include: {
        user: true
      }
    }),
    session.user.role === "admin"
      ? db.organizationUser.findMany({
          where: {
            organizationId: session.user.organizationId,
            active: true
          },
          include: {
            user: true
          },
          orderBy: {
            createdAt: "asc"
          }
        })
      : Promise.resolve([])
  ]);

  if (!membership) {
    redirect("/login");
  }

  const baseMembers = session.user.role === "admin" ? adminMembers : [membership];
  const memberOptions = baseMembers
    .map((member: any) => ({
      membershipId: member.id,
      name: member.user.name ?? member.user.email,
      email: member.user.email
    }))
    .sort((a: { name: string; email: string }, b: { name: string; email: string }) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));

  return (
    <div className="space-y-5">
      <AppNav role={session.user.role} user={session.user} />
      <GoalsBoard role={session.user.role} members={memberOptions} currentMembershipId={membership.id} />
    </div>
  );
}
