"use client";

import { useId, useSyncExternalStore } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  canVibrate,
  isVibrationOn,
  setVibrationOn,
  subscribeVibration,
} from "@/lib/haptics";

const never = () => () => {};

// Only offered where the phone can vibrate. The choice is kept on this device, not with the User.
export function VibrationSection() {
  const id = useId();
  // The server cannot know what the phone supports, so it renders nothing and this fills in.
  const supported = useSyncExternalStore(never, canVibrate, () => false);
  const on = useSyncExternalStore(
    subscribeVibration,
    isVibrationOn,
    () => true,
  );

  if (!supported) return null;

  return (
    <section className="flex flex-col gap-2">
      {/* The whole row is the label, so the target is far bigger than the switch itself. */}
      <Label
        htmlFor={id}
        className="min-h-12 justify-between gap-4 font-medium text-lg leading-normal"
      >
        Vibration
        <Switch id={id} checked={on} onCheckedChange={setVibrationOn} />
      </Label>
      <p className="text-muted-foreground text-sm">
        A short buzz when you log a food, pick items, or something doesn't save.
        This is saved on this phone only.
      </p>
    </section>
  );
}
