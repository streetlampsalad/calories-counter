"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { TOGGLE_KEY } from "@/features/bug-reports/domain";
import { useToggle } from "@/features/toggles/queries";

// The way into Report a bug (spec 194), there only while its Toggle is on for the User.
export function ReportABugRow() {
  const on = useToggle(TOGGLE_KEY);
  if (!on) return null;

  return (
    <section className="flex flex-col gap-2">
      <Link
        href="/settings/report-a-bug"
        className="flex min-h-12 items-center justify-between gap-4 font-medium text-lg"
      >
        Report a bug
        <ChevronRight
          aria-hidden="true"
          className="size-5 text-muted-foreground"
        />
      </Link>
      <p className="text-muted-foreground text-sm">
        Tell the owner something is broken. Your Toggles are attached for you.
      </p>
    </section>
  );
}
