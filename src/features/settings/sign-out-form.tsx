"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { unsubscribeThisDevice } from "@/features/reminders/push";

async function forgetThisPhone() {
  try {
    await unsubscribeThisDevice();
  } catch {
    // Signing out matters more than tidying up.
  }
}

// Signing out first removes this phone's push subscription, which needs the User's session, so a
// phone that has signed out never receives their Reminder (spec 016 AC-8). The clean-up is best
// effort and short: it must never stop someone signing out.
export function SignOutForm({ action }: { action: () => Promise<void> }) {
  const cleanedUp = useRef(false);

  return (
    <form
      action={action}
      onSubmit={async (event) => {
        if (cleanedUp.current) return;
        event.preventDefault();
        const form = event.currentTarget;
        await Promise.race([
          forgetThisPhone(),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
        cleanedUp.current = true;
        form.requestSubmit();
      }}
    >
      <Button type="submit" variant="outline" className="h-12 w-full text-base">
        Sign out
      </Button>
    </form>
  );
}
