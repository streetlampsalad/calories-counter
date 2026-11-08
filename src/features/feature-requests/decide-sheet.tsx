"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Decision } from "./domain";
import { useDecide } from "./queries";

const COPY: Record<
  Decision,
  { button: string; title: string; body: string; confirm: string }
> = {
  ready: {
    button: "It's ready",
    title: "Turn it on for everyone?",
    body: "will be on for every User, and this can't be undone. An agent then tidies up the code behind it.",
    confirm: "Turn it on for everyone",
  },
};

// It's ready (spec 135 US2), after asking: the decision is for everyone and can't be undone.
export function DecideSheet({
  id,
  goal,
  decision,
}: {
  id: string;
  goal: string;
  decision: Decision;
}) {
  const [asking, setAsking] = useState(false);
  const decide = useDecide();
  const copy = COPY[decision];

  function confirm() {
    setAsking(false);
    decide.mutate(
      { id, decision },
      { onError: (error) => toast.error(error.message) },
    );
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-11 self-start"
        disabled={decide.isPending}
        onClick={() => setAsking(true)}
      >
        {copy.button}
      </Button>
      <Sheet open={asking} onOpenChange={(next) => !next && setAsking(false)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{copy.title}</SheetTitle>
            <SheetDescription>
              “{goal}” {copy.body}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4 pb-6">
            <Button onClick={() => setAsking(false)} className="h-12 text-base">
              Keep testing
            </Button>
            <Button
              variant="outline"
              onClick={confirm}
              className="h-12 text-base"
            >
              {copy.confirm}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
