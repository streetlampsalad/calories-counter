"use client";

import { useId } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings, useUpdateSettings } from "./queries";

// Calories Burned is optional (spec 017): while this is off, nothing about it shows anywhere, and
// turning it off keeps what was entered.
export function BurnedSection() {
  const id = useId();
  const { data: settings, isPending } = useSettings();
  const update = useUpdateSettings();

  function save(trackCaloriesBurned: boolean) {
    update.mutate(
      { trackCaloriesBurned },
      {
        onError: (error) =>
          toast.error(error.message, {
            action: {
              label: "Retry",
              onClick: () => save(trackCaloriesBurned),
            },
          }),
      },
    );
  }

  return (
    <section className="flex flex-col gap-2">
      {isPending ? (
        <div
          aria-hidden="true"
          className="h-12 animate-pulse rounded-lg bg-muted"
        />
      ) : null}

      {settings ? (
        // The whole row is the label, so the target is far bigger than the switch itself.
        <Label
          htmlFor={id}
          className="min-h-12 justify-between gap-4 font-medium text-lg leading-normal"
        >
          Track calories burned
          <Switch
            id={id}
            checked={settings.trackCaloriesBurned}
            onCheckedChange={save}
          />
        </Label>
      ) : null}

      <p className="text-muted-foreground text-sm">
        Add what your watch says you burned each day, to see whether you ate
        less than you burned. Switching this off hides it and keeps what you
        entered.
      </p>
    </section>
  );
}
