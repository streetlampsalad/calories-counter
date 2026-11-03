"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Props = {
  open: boolean;
  rows: number;
  onKeep: () => void;
  onDiscard: () => void;
};

// Asked before unsaved Import Review rows are thrown away.
export function DiscardSheet({ open, rows, onKeep, onDiscard }: Props) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onKeep()}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Discard these rows?</SheetTitle>
          <SheetDescription>
            {rows === 1
              ? "1 row hasn't been saved."
              : `${rows} rows haven't been saved.`}{" "}
            They will be lost if you leave.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 pb-6">
          <Button onClick={onKeep} className="h-12 text-base">
            Keep editing
          </Button>
          <Button
            variant="outline"
            onClick={onDiscard}
            className="h-12 text-base"
          >
            Discard
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
