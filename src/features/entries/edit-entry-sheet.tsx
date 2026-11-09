"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToggle } from "@/features/toggles/queries";
import { formatEntryDetail } from "./domain";
import type { MealTime } from "./meal-time";
import { MealTimeChips } from "./meal-time-chips";
import { QuantityPicker } from "./quantity-picker";
import type { Entry } from "./types";

type Props = {
  /** The Entry being edited; null keeps the sheet closed. */
  entry: Entry | null;
  onChange: (entry: Entry, quantity: number) => void;
  onChangeMealTime: (entry: Entry, mealTime: MealTime | null) => void;
  onRemove: (entry: Entry) => void;
  onClose: () => void;
};

export function EditEntrySheet({
  entry,
  onChange,
  onChangeMealTime,
  onRemove,
  onClose,
}: Props) {
  const mealTimesOn = useToggle("feature-173");
  return (
    <Sheet open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit entry</SheetTitle>
          <SheetDescription>How much did you have?</SheetDescription>
        </SheetHeader>
        {entry ? (
          <div className="flex flex-col gap-4 px-4 pb-6">
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">{entry.food.name}</p>
              <p className="text-muted-foreground text-sm">
                {formatEntryDetail(entry)}
              </p>
            </div>
            <QuantityPicker
              // A fresh stepper for each Entry, starting from its current amount.
              key={entry.id}
              verb="Set to"
              initial={entry.quantity}
              onChoose={(quantity) => {
                onChange(entry, quantity);
                onClose();
              }}
            />
            {mealTimesOn ? (
              <MealTimeChips
                value={entry.mealTime ?? null}
                onChange={(mealTime) => {
                  onChangeMealTime(entry, mealTime);
                  onClose();
                }}
              />
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full gap-2 text-base text-destructive"
              onClick={() => {
                onRemove(entry);
                onClose();
              }}
            >
              <Trash2 aria-hidden="true" /> Remove entry
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
