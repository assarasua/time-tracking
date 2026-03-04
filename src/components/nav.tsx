import Link from "next/link";
import { Role } from "@prisma/client";

import { SignOutButton } from "@/components/auth-buttons";

export function AppNav({ role }: { role: Role }) {
  return (
    <div className="card row" style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 16 }}>
        <Link href="/dashboard">Dashboard</Link>
        {role === "admin" ? <Link href="/admin">Admin</Link> : null}
      </div>
      <SignOutButton />
    </div>
  );
}
