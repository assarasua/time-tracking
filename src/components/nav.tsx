"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { MouseEvent } from "react";

import { AdminModalShell } from "@/components/admin-modal-shell";
import { ProfileTimezoneSettings } from "@/components/profile-timezone-settings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type AppRole = "admin" | "employee";

type TabItem = {
  label: string;
  href: Route;
};

type NavUser = {
  name: string | null;
  email: string;
  avatarUrl?: string | null;
};

function getInitials(name: string | null, email: string) {
  const source = (name?.trim() || email).replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) || "U").toUpperCase();
}

export function AppNav({ role, user }: { role: AppRole; user: NavUser }) {
  const pathname = usePathname();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsAnchorTop, setSettingsAnchorTop] = useState(24);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const primaryTabs: TabItem[] = [
    { label: "Dashboard", href: "/dashboard" as Route },
    { label: "Timesheet", href: "/timesheet" as Route },
    { label: "Time off", href: "/time-off" as Route },
    { label: "Invoices", href: "/invoices" as Route },
    { label: "Expenses", href: "/expenses" as Route },
    { label: "Goals", href: "/goals" as Route }
  ];
  const adminTab = role === "admin" ? { label: "Admin", href: "/admin" as Route } : null;
  const initials = getInitials(user.name, user.email);
  const activeTab = (adminTab ? [...primaryTabs, adminTab] : primaryTabs).find(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)
  );

  function openSettings(event: MouseEvent<HTMLButtonElement>) {
    const viewportHeight = window.innerHeight;
    const nextTop = Math.min(Math.max(16, event.currentTarget.getBoundingClientRect().top - 24), Math.max(16, viewportHeight - 280));
    setSettingsAnchorTop(nextTop);
    setShowSettings(true);
  }

  return (
    <div className="sticky top-2 z-40">
      {showSettings ? (
        <AdminModalShell
          title="Profile settings"
          onClose={() => setShowSettings(false)}
          sizeClassName="max-w-lg"
          zIndexClassName="z-[60]"
          anchorTop={settingsAnchorTop}
        >
          <ProfileTimezoneSettings closeOnSelect onSaved={() => setShowSettings(false)} />
        </AdminModalShell>
      ) : null}
      {showMobileMenu ? (
        <div className="fixed inset-0 z-[55] bg-foreground/30 sm:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-x-4 top-20 rounded-2xl border border-border bg-card p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Navigation</p>
                <p className="text-xs text-muted-foreground">{activeTab?.label ?? "Open a section"}</p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setShowMobileMenu(false)}>
                Close
              </Button>
            </div>

            <div className="space-y-2">
              {primaryTabs.map((tab) => {
                const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    prefetch
                    onClick={() => setShowMobileMenu(false)}
                    className={cn(
                      "flex h-11 items-center rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground hover:bg-accent"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {tab.label}
                  </Link>
                );
              })}
              {adminTab ? (() => {
                const isActive = pathname === adminTab.href || pathname.startsWith(`${adminTab.href}/`);
                return (
                  <Link
                    href={adminTab.href}
                    prefetch
                    onClick={() => setShowMobileMenu(false)}
                    className={cn(
                      "mt-2 flex h-11 items-center rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      isActive ? "bg-accent text-accent-foreground" : "bg-accent/15 text-foreground hover:bg-accent/25"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {adminTab.label}
                  </Link>
                );
              })() : null}
            </div>
          </div>
        </div>
      ) : null}
      <div className="rounded-2xl border border-border/80 bg-card/95 px-3 py-3 shadow-sm backdrop-blur sm:px-4">
        <div className="flex flex-col gap-3 sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" className="border border-border bg-muted/50" onClick={() => setShowMobileMenu(true)}>
              Menu
            </Button>
            <div className="min-w-0 flex-1 text-right">
              <p className="truncate text-sm font-semibold text-foreground">{activeTab?.label ?? "Hutech HR Hub"}</p>
              <p className="text-xs text-muted-foreground">Open section menu</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border/70 pt-2">
            <button
              type="button"
              onClick={openSettings}
              className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              title="Open profile settings"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={`${user.name ?? user.email} avatar`}
                  className="size-8 rounded-full border border-border object-cover"
                />
              ) : (
                <span className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
                  {initials}
                </span>
              )}
              <span className="truncate text-sm font-medium text-foreground">{user.name ?? user.email}</span>
            </button>
            <form method="post" action="/api/auth/logout" className="shrink-0">
              <button
                type="submit"
                className="inline-flex h-8 items-center text-sm font-semibold text-destructive transition-colors hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="relative hidden min-h-[44px] items-center justify-center sm:flex">
          <div className="flex w-fit max-w-full items-center gap-2">
            <div className="rounded-xl border border-border/80 bg-muted/60 p-1">
              <div className="inline-flex min-w-max items-center gap-1">
                {primaryTabs.map((tab) => {
                  const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      prefetch
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
            {adminTab ? (() => {
              const isActive = pathname === adminTab.href || pathname.startsWith(`${adminTab.href}/`);
              return (
                <div className="rounded-xl border border-accent/60 bg-accent/15 p-1">
                  <Link
                    href={adminTab.href}
                    prefetch
                    className={cn(
                      "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold leading-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      isActive
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "text-foreground hover:bg-background hover:text-foreground"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {adminTab.label}
                  </Link>
                </div>
              );
            })() : null}
          </div>

          <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-3">
            <button
              type="button"
              onClick={openSettings}
              className="flex max-w-[220px] items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              title="Open profile settings"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={`${user.name ?? user.email} avatar`}
                  className="size-8 rounded-full border border-border object-cover"
                />
              ) : (
                <span className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
                  {initials}
                </span>
              )}
              <span className="truncate text-sm font-medium text-foreground">{user.name ?? user.email}</span>
            </button>
            <form method="post" action="/api/auth/logout">
              <button
                type="submit"
                className="inline-flex h-8 items-center text-sm font-semibold text-destructive transition-colors hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
