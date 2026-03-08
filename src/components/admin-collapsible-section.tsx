"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export function AdminCollapsibleSection({
  title,
  description,
  children,
  defaultOpen = true,
  className
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            className={cn("border border-border bg-background px-3 text-xs font-semibold", !isOpen && "text-muted-foreground")}
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
          >
            {isOpen ? "Minimize" : "Expand"}
          </Button>
        </div>
      </CardHeader>
      {isOpen ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}
