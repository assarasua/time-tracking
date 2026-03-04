import Link from "next/link";
import { Role } from "@prisma/client";

import { SignOutButton } from "@/components/auth-buttons";
import { Card, CardContent } from "@/components/ui/card";

export function AppNav({ role }: { role: Role }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 text-sm font-medium text-nav-selected transition-colors hover:bg-muted"
          >
            Dashboard
          </Link>
          {role === "admin" ? (
            <Link
              href="/admin"
              className="rounded-md px-3 py-2 text-sm font-medium text-nav-selected transition-colors hover:bg-muted"
            >
              Admin
            </Link>
          ) : null}
        </div>
        <SignOutButton />
      </CardContent>
    </Card>
  );
}
