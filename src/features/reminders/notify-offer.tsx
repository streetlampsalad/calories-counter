"use client";

import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { canReceivePush, subscribeThisDevice, vapidPublicKey } from "./push";

const never = () => () => {};
const permissionNow = (): NotificationPermission | "unsupported" =>
  canReceivePush() && vapidPublicKey()
    ? Notification.permission
    : "unsupported";

// Offered while the User hasn't decided and push is supported, so they hear when what they sent has
// news. Declining changes nothing about sending (spec 124 US1.8, spec 194 US3.8).
export function NotifyOffer({
  label,
  hint,
  granted,
}: {
  /** The button, e.g. "Notify me when it's ready". */
  label: string;
  /** Under the button while the User hasn't decided. */
  hint: string;
  /** Shown once they say yes here. */
  granted: string;
}) {
  const initial = useSyncExternalStore(
    never,
    permissionNow,
    () => "unsupported" as const,
  );
  const [answer, setAnswer] = useState<NotificationPermission | null>(null);
  const permission = answer ?? initial;

  async function ask() {
    const key = vapidPublicKey();
    const result = await Notification.requestPermission();
    setAnswer(result);
    if (result === "granted" && key) {
      try {
        await subscribeThisDevice(key);
      } catch {
        toast.error("Couldn't turn on notifications on this phone.");
      }
    }
  }

  if (permission === "default") {
    return (
      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" size="lg" onClick={ask}>
          {label}
        </Button>
        <p className="text-muted-foreground text-sm">{hint}</p>
      </div>
    );
  }
  if (answer === "granted") {
    return <p className="text-muted-foreground text-sm">{granted}</p>;
  }
  return null;
}
