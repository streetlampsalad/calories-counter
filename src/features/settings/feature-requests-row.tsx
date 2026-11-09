"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

// The way into Feature Requests (spec 124), there for every User.
export function FeatureRequestsRow() {
  return (
    <section className="flex flex-col gap-2">
      <Link
        href="/settings/feature-requests"
        className="flex min-h-12 items-center justify-between gap-4 font-medium text-lg"
      >
        Feature requests
        <ChevronRight
          aria-hidden="true"
          className="size-5 text-muted-foreground"
        />
      </Link>
      <p className="text-muted-foreground text-sm">
        Ask for something new, and follow it as it's built.
      </p>
    </section>
  );
}
