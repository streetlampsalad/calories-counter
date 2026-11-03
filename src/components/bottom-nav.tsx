"use client";

import { CalendarDays, ChartColumn, Settings, Utensils } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Each feature spec adds its own tab here in its final slice (ADR 0003).
const TABS = [
  { href: "/", label: "Today", icon: CalendarDays },
  { href: "/foods", label: "Foods", icon: Utensils },
  { href: "/summary", label: "Summary", icon: ChartColumn },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function isCurrent(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, icon: Icon }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 font-medium text-xs",
                  current ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
