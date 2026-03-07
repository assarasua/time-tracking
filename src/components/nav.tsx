"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { ProfileTimezoneSettings } from "@/components/profile-timezone-settings";
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
  const mobileRailRef = useRef<HTMLDivElement | null>(null);
  const mobileTabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const primaryTabs: TabItem[] = [
    { label: "Dashboard", href: "/dashboard" as Route },
    { label: "Timesheet", href: "/timesheet" as Route },
    { label: "Time off", href: "/time-off" as Route },
    { label: "Goals", href: "/goals" as Route },
    { label: "Invoices", href: "/invoices" as Route }
  ];
  const adminTab = role === "admin" ? { label: "Admin", href: "/admin" as Route } : null;
  const initials = getInitials(user.name, user.email);

  useEffect(() => {
    const allTabs = adminTab ? [...primaryTabs, adminTab] : primaryTabs;
    const activeTab = allTabs.find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
    if (!activeTab) return;

    const rail = mobileRailRef.current;
    const activeElement = mobileTabRefs.current[activeTab.href];
    if (!rail || !activeElement) return;

    const railRect = rail.getBoundingClientRect();
    const activeRect = activeElement.getBoundingClientRect();
    const targetScrollLeft = rail.scrollLeft + (activeRect.left - railRect.left) - rail.clientWidth / 2 + activeRect.width / 2;

    rail.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: "smooth"
    });
  }, [pathname, primaryTabs, adminTab]);

  return (
    <div className="sticky top-2 z-40">
      {showSettings ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-foreground/30 p-4 pt-20 sm:pt-24" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-semibold text-foreground">Profile settings</p>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="inline-flex h-8 items-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Close
              </button>
            </div>
            <ProfileTimezoneSettings closeOnSelect onSaved={() => setShowSettings(false)} />
          </div>
        </div>
      ) : null}
      <div className="rounded-2xl border border-border/80 bg-card/95 px-3 py-3 shadow-sm backdrop-blur sm:px-4">
        <div className="flex flex-col gap-3 sm:hidden">
          <div ref={mobileRailRef} className="-mx-1 overflow-x-auto px-1">
            <div className="mx-auto flex w-fit min-w-max items-center gap-2">
              <div className="rounded-xl border border-border/80 bg-muted/60 p-1">
                <div className="inline-flex min-w-max items-center gap-1">
                  {primaryTabs.map((tab) => {
                    const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        ref={(element) => {
                          mobileTabRefs.current[tab.href] = element;
                        }}
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
                      ref={(element) => {
                        mobileTabRefs.current[adminTab.href] = element;
                      }}
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
          </div>
          <div className="flex items-center justify-between border-t border-border/70 pt-2">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
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
              onClick={() => setShowSettings(true)}
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
