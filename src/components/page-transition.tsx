"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(false);
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out will-change-transform",
        visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      )}
    >
      {children}
    </div>
  );
}
