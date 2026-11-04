"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Shown on any Day but today. Otherwise it fades away and can't be reached or tapped. */
  visible: boolean;
  onClick: () => void;
};

// A quick way home after wandering into the past or the plan. It floats at the bottom-left, level
// with Add, so showing and hiding it never moves anything on the Day (spec 019). It stays mounted
// so it can fade; hidden, it is invisible, which also takes it out of tapping, tabbing and
// screen readers.
export function TodayPill({ visible, onClick }: Props) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        "h-12 rounded-full px-5 text-base shadow-lg transition-[opacity,visibility] duration-200 motion-reduce:transition-none",
        visible
          ? "pointer-events-auto visible opacity-100"
          : "pointer-events-none invisible opacity-0",
      )}
    >
      Today
    </Button>
  );
}
