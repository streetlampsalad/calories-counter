"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GoalSheet } from "./goal-sheet";
import { useSettings, useUpdateSettings } from "./queries";

export function GoalSection() {
  const { data: settings, isPending, isError } = useSettings();
  const update = useUpdateSettings();
  const [editing, setEditing] = useState(false);

  function save(dailyGoal: number | null) {
    update.mutate(
      { dailyGoal },
      {
        onError: (error) =>
          toast.error(error.message, {
            action: { label: "Retry", onClick: () => save(dailyGoal) },
          }),
      },
    );
  }

  const goal = settings?.dailyGoal ?? null;

  return (
    <section aria-labelledby="goal-heading" className="flex flex-col gap-3">
      <h2 id="goal-heading" className="font-medium text-lg">
        Daily goal
      </h2>

      {isPending ? (
        <div
          aria-hidden="true"
          className="h-14 animate-pulse rounded-lg bg-muted"
        />
      ) : null}

      {isError ? (
        <p className="text-destructive text-sm">Couldn't load your settings.</p>
      ) : null}

      {settings ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Daily goal: ${goal === null ? "not set" : `${goal.toLocaleString("en-AU")} calories`}. Change`}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-4 text-left"
        >
          <span className="flex flex-col">
            <span className="font-medium">
              {goal === null
                ? "Not set"
                : `${goal.toLocaleString("en-AU")} kcal`}
            </span>
            <span className="text-muted-foreground text-sm">
              {goal === null
                ? "Set a target to see how each day compares"
                : "Compared with each day's total"}
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
        </button>
      ) : null}

      <GoalSheet
        open={editing}
        current={goal}
        onSave={save}
        onClose={() => setEditing(false)}
      />
    </section>
  );
}
