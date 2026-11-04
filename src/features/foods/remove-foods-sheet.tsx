"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { removalSummary } from "./domain";
import type { Food } from "./types";

type Props = {
  open: boolean;
  /** The Foods that were picked. */
  foods: readonly Food[];
  /** How many Entries each Food has, once known. */
  entryCounts: Readonly<Record<string, number>> | undefined;
  onConfirm: () => void;
  onClose: () => void;
};

// Asked before several Foods are removed at once, saying how many will be archived and deleted.
export function RemoveFoodsSheet({
  open,
  foods,
  entryCounts,
  onConfirm,
  onClose,
}: Props) {
  const { title, description, confirmLabel } = removalSummary(
    foods,
    entryCounts,
  );

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 pb-6">
          <Button
            variant="destructive"
            onClick={onConfirm}
            className="h-12 text-base"
          >
            {confirmLabel}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="h-12 text-base"
          >
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
