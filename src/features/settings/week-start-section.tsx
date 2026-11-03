"use client";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { WeekStart } from "./domain";
import { useSettings, useUpdateSettings } from "./queries";

const OPTIONS: ReadonlyArray<{ value: WeekStart; label: string }> = [
  { value: 1, label: "Monday" },
  { value: 0, label: "Sunday" },
];

export function WeekStartSection() {
  const { data: settings, isPending } = useSettings();
  const update = useUpdateSettings();

  function choose(weekStartsOn: WeekStart) {
    update.mutate(
      { weekStartsOn },
      {
        onError: (error) =>
          toast.error(error.message, {
            action: { label: "Retry", onClick: () => choose(weekStartsOn) },
          }),
      },
    );
  }

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-3 font-medium text-lg">Week starts on</legend>

      {isPending ? (
        <div
          aria-hidden="true"
          className="h-12 animate-pulse rounded-lg bg-muted"
        />
      ) : null}

      {settings ? (
        <div className="flex gap-2">
          {OPTIONS.map(({ value, label }) => {
            const selected = settings.weekStartsOn === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => !selected && choose(value)}
                className={cn(
                  "min-h-12 flex-1 rounded-lg border text-base",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      <p className="text-muted-foreground text-sm">
        Decides which days count as this week and last week in your summaries.
      </p>
    </fieldset>
  );
}
