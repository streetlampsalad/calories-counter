"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { isPlanned } from "@/features/entries/days";
import { dailyTotal } from "@/features/entries/domain";
import type { Entry } from "@/features/entries/types";
import { useSettings } from "@/features/settings/queries";
import { BurnedSheet } from "./burned-sheet";
import { burnedRowText } from "./domain";
import { useDayBurned, useSetBurned } from "./queries";

type Props = {
  day: string;
  today: string;
  entries: readonly Entry[];
};

// Under the Daily Total, for a User who tracks Calories Burned (spec 017): what the watch said, and
// whether that made a Deficit. Tapping it sets the figure. Nothing at all for anyone else, and
// nothing for a Day still to come, which has not been burned yet.
export function BurnedRow({ day, today, entries }: Props) {
  const { data: settings } = useSettings();
  const tracking = settings?.trackCaloriesBurned === true;
  const planned = isPlanned(day, today);
  const shown = tracking && !planned;
  const { data: burned, isPending } = useDayBurned(day, shown);
  const setBurned = useSetBurned();
  const [editing, setEditing] = useState(false);

  if (!shown) return null;
  if (isPending) {
    return (
      <div
        aria-hidden="true"
        className="h-12 animate-pulse rounded-lg bg-muted"
      />
    );
  }

  const current = burned ?? null;
  const { heading, detail } = burnedRowText({
    caloriesBurned: current,
    hasEntries: entries.length > 0,
    dailyTotal: dailyTotal(entries),
    isToday: day === today,
  });

  function save(calories: number | null) {
    setBurned.mutate(
      { day, calories },
      {
        onError: (error) =>
          toast.error(error.message, {
            action: { label: "Retry", onClick: () => save(calories) },
          }),
      },
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`${heading} · ${detail}`}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border px-4 text-left"
      >
        <span>
          <span className="font-medium">{heading}</span>
          <span className="text-muted-foreground">
            {" · "}
            {detail}
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground"
        />
      </button>

      <BurnedSheet
        open={editing}
        current={current}
        onSave={save}
        onClose={() => setEditing(false)}
      />
    </>
  );
}
