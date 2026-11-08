"use client";

import { useId } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  type Toggle,
  useSwitchToggle,
  useToggles,
} from "@/features/toggles/queries";

// The Toggles in Testing this User may try (spec 116): only the Owner, for now. Hidden while
// loading, after an error and when there is nothing to try, so other Users never see it.
export function TryFeaturesSection() {
  const id = useId();
  const { data: toggles } = useToggles();
  const switchable = toggles?.filter((toggle) => toggle.canSwitch) ?? [];

  if (switchable.length === 0) return null;

  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="font-medium text-lg">
        Try new features
      </h2>
      <p className="text-muted-foreground text-sm">
        Features still being built. Turning one on shows it to you only.
      </p>
      <ul className="flex flex-col">
        {switchable.map((toggle) => (
          <li key={toggle.key}>
            <ToggleRow toggle={toggle} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ToggleRow({ toggle }: { toggle: Toggle }) {
  const id = useId();
  const switchToggle = useSwitchToggle();

  function save(on: boolean) {
    switchToggle.mutate(
      { key: toggle.key, on },
      {
        onError: (error) =>
          toast.error(error.message, {
            action: { label: "Retry", onClick: () => save(on) },
          }),
      },
    );
  }

  return (
    // The whole row is the label, so the target is far bigger than the switch itself.
    <Label
      htmlFor={id}
      className="min-h-12 justify-between gap-4 font-normal text-base leading-normal"
    >
      {toggle.title}
      <Switch id={id} checked={toggle.isOn} onCheckedChange={save} />
    </Label>
  );
}
