"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  canReceivePush,
  currentEndpoint,
  deviceTimeZone,
  reminderKeys,
  subscribeThisDevice,
  unsubscribeThisDevice,
  vapidPublicKey,
} from "@/features/reminders/push";
import { type Settings, toQuarterHour } from "./domain";
import { useSettings, useUpdateSettings } from "./queries";

const never = () => () => {};
// The server cannot know what this phone supports, so it renders nothing and the phone fills in.
const support = () => (canReceivePush() ? "yes" : "no");

// The daily Reminder (spec 016): one switch and a time, which belong to the User. Turning it on from
// a phone also subscribes that phone, so it is the phones you turned it on from that buzz.
export function ReminderSection() {
  const switchId = useId();
  const timeId = useId();
  const publicKey = vapidPublicKey();
  const capable = useSyncExternalStore(never, support, () => "pending");
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const queryClient = useQueryClient();
  const device = useQuery({
    queryKey: reminderKeys.device(),
    queryFn: currentEndpoint,
    enabled: capable === "yes",
  });
  const [blocked, setBlocked] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (capable === "yes" && Notification.permission === "denied") {
      setBlocked(true);
    }
  }, [capable]);

  // Not set up on this deployment yet, or still working out what this phone can do.
  if (!publicKey || capable === "pending") return null;

  function save(patch: Partial<Settings>, onSaved?: () => void) {
    update.mutate(patch, {
      onSuccess: onSaved,
      onError: (error) =>
        toast.error(error.message, {
          action: { label: "Retry", onClick: () => save(patch, onSaved) },
        }),
    });
  }

  async function turnOn(key: string) {
    setWorking(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        // "default" means the prompt was dismissed: ask again next time, say nothing.
        setBlocked(permission === "denied");
        return;
      }
      setBlocked(false);
      await subscribeThisDevice(key);
      await queryClient.invalidateQueries({ queryKey: reminderKeys.device() });
      save({ reminderEnabled: true, timeZone: deviceTimeZone() });
    } catch {
      toast.error(
        "Couldn't turn on the reminder. Check your connection and try again.",
        { action: { label: "Retry", onClick: () => turnOn(key) } },
      );
    } finally {
      setWorking(false);
    }
  }

  function turnOff() {
    // Off for the User means off for every phone. This one also forgets its subscription.
    save({ reminderEnabled: false }, async () => {
      try {
        await unsubscribeThisDevice();
      } catch {
        // The Reminder is off either way; a leftover subscription is never sent to.
      }
      await queryClient.invalidateQueries({ queryKey: reminderKeys.device() });
    });
  }

  function changeTime(value: string) {
    const time = toQuarterHour(value);
    if (!time || time === settings?.reminderTime) return;
    save({ reminderTime: time, timeZone: deviceTimeZone() });
  }

  const unsupported = capable === "no";
  const ready = settings !== undefined && (unsupported || !device.isPending);
  const thisPhoneSubscribed = Boolean(device.data);
  const on = Boolean(settings?.reminderEnabled) && thisPhoneSubscribed;
  const onElsewhere =
    Boolean(settings?.reminderEnabled) && !thisPhoneSubscribed && !unsupported;

  return (
    <section
      aria-labelledby={`${switchId}-heading`}
      className="flex flex-col gap-2"
    >
      <h2 id={`${switchId}-heading`} className="sr-only">
        Reminder
      </h2>

      {ready ? (
        <>
          {/* The whole row is the label, so the target is far bigger than the switch itself. */}
          <Label
            htmlFor={switchId}
            className="min-h-12 justify-between gap-4 font-medium text-lg leading-normal"
          >
            Daily reminder
            <Switch
              id={switchId}
              checked={on}
              disabled={unsupported || working}
              onCheckedChange={(next) => {
                if (next && publicKey) void turnOn(publicKey);
                else if (!next) turnOff();
              }}
            />
          </Label>

          {on && settings ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor={timeId} className="text-base">
                Remind me at
              </Label>
              <Input
                id={timeId}
                type="time"
                step={900}
                value={settings.reminderTime}
                onChange={(event) => changeTime(event.target.value)}
                className="h-12 text-base"
              />
            </div>
          ) : null}
        </>
      ) : (
        <div
          aria-hidden="true"
          className="h-12 animate-pulse rounded-lg bg-muted"
        />
      )}

      {unsupported ? (
        <p className="text-muted-foreground text-sm">
          This device can't show reminders.
        </p>
      ) : null}
      {blocked && !on ? (
        <p role="alert" className="text-destructive text-sm">
          Notifications are blocked for this app in Android settings.
        </p>
      ) : null}
      {onElsewhere && !blocked ? (
        <p className="text-muted-foreground text-sm">
          Your reminder is on for your other phones. Turn it on here to get it
          on this phone too.
        </p>
      ) : null}
      <p className="text-muted-foreground text-sm">
        A notification at the time you choose, if you haven't logged anything
        that day.
      </p>
    </section>
  );
}
