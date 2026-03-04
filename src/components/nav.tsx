"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

type AppRole = "admin" | "employee";

type TabItem = {
  label: string;
  href: Route;
};

export function AppNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const tabs: TabItem[] = [
    { label: "Dashboard", href: "/dashboard" as Route },
    { label: "Timesheet", href: "/timesheet" as Route },
    ...(role === "admin" ? [{ label: "Admin", href: "/admin" as Route }] : [])
  ];

  return (
    <div className="py-1">
        <div className="flex flex-col gap-2 sm:hidden">
          <div className="w-full overflow-x-auto">
            <div className="mx-auto w-fit max-w-full rounded-xl border border-border/80 bg-muted/60 p-1">
              <div className="inline-flex min-w-max items-center gap-1">
                {tabs.map((tab) => {
                  const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={cn(
                        "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold leading-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-background hover:text-foreground"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
          <form method="post" action="/api/auth/logout" className="flex justify-end">
            <button
              type="submit"
              className="inline-flex h-9 items-center text-sm font-semibold text-destructive transition-colors hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="relative hidden min-h-[44px] items-center justify-center sm:flex">
          <div className="w-fit max-w-full rounded-xl border border-border/80 bg-muted/60 p-1">
            <div className="inline-flex min-w-max items-center gap-1">
              {tabs.map((tab) => {
                const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold leading-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background hover:text-foreground"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <form method="post" action="/api/auth/logout" className="absolute right-0 top-1/2 -translate-y-1/2">
            <button
              type="submit"
              className="inline-flex h-9 items-center text-sm font-semibold text-destructive transition-colors hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              Sign out
            </button>
          </form>
        </div>
    </div>
  );
}
