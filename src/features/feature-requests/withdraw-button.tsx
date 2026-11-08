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
import { useWithdrawFeatureRequest } from "./queries";

// Withdraws a request before building starts, after asking (spec 124 US4).
export function WithdrawButton({ id, goal }: { id: string; goal: string }) {
  const [asking, setAsking] = useState(false);
  const withdraw = useWithdrawFeatureRequest();

  function confirm() {
    setAsking(false);
    withdraw.mutate(id, { onError: (error) => toast.error(error.message) });
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-11 self-start"
        disabled={withdraw.isPending}
        onClick={() => setAsking(true)}
      >
        Withdraw
      </Button>
      <Sheet open={asking} onOpenChange={(next) => !next && setAsking(false)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Withdraw this request?</SheetTitle>
            <SheetDescription>
              “{goal}” will stop here, and its Issues on GitHub will be closed.
              You can ask again any time.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4 pb-6">
            <Button onClick={() => setAsking(false)} className="h-12 text-base">
              Keep it
            </Button>
            <Button
              variant="outline"
              onClick={confirm}
              className="h-12 text-base"
            >
              Withdraw request
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
