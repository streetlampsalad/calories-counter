"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { findDuplicate } from "./domain";
import { FoodForm } from "./food-form";
import { useFoodEntryCounts } from "./queries";
import type { Food, FoodInput } from "./types";

type Props = {
  /** The Food being edited; null keeps the sheet closed. */
  food: Food | null;
  foods: readonly Food[];
  onSave: (food: Food) => void;
  /** hasEntries decides between deleting for good and archiving (ADR 0001). */
  onRemove: (food: Food, hasEntries: boolean) => void;
  onClose: () => void;
};

function entriesWarning(count: number) {
  const noun = count === 1 ? "Entry" : "Entries";
  return `Changing this updates ${count.toLocaleString("en-AU")} ${noun}`;
}

function RemoveSection({
  food,
  entryCount,
  loaded,
  onRemove,
}: {
  food: Food;
  entryCount: number;
  loaded: boolean;
  onRemove: (food: Food, hasEntries: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (entryCount > 0) {
    return (
      <div className="flex flex-col gap-2 border-t pt-4">
        <p className="text-muted-foreground text-sm">
          Archiving takes it out of your list, but past Entries keep their
          calories. You can restore it from Archived foods.
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full text-base"
          onClick={() => onRemove(food, true)}
        >
          Archive food
        </Button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-3 border-t pt-4">
        <p className="text-sm">
          Delete {food.name} for good? This can't be undone.
        </p>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 text-base"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-12 flex-1 text-base"
            onClick={() => onRemove(food, false)}
          >
            Yes, delete
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t pt-4">
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full text-base text-destructive"
        // Waiting for the count means we never delete a Food whose history we haven't checked.
        disabled={!loaded}
        onClick={() => setConfirming(true)}
      >
        Delete food
      </Button>
    </div>
  );
}

export function EditFoodSheet({
  food,
  foods,
  onSave,
  onRemove,
  onClose,
}: Props) {
  const { data: counts } = useFoodEntryCounts(food !== null);
  const entryCount = food ? (counts?.[food.id] ?? 0) : 0;

  return (
    <Sheet open={food !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit food</SheetTitle>
          <SheetDescription>
            Calories are for one portion, like 1 slice or 100 g.
          </SheetDescription>
        </SheetHeader>
        {food ? (
          <div className="flex flex-col gap-4 px-4 pb-6">
            {entryCount > 0 ? (
              <p className="rounded-lg bg-muted px-4 py-3 text-sm">
                {entriesWarning(entryCount)}
              </p>
            ) : null}
            <FoodForm
              // A fresh form for each Food, so fields never carry over between edits.
              key={food.id}
              submitLabel="Save changes"
              initialValues={{
                name: food.name,
                portion: food.portion,
                calories: String(food.calories),
              }}
              findExisting={(input) => findDuplicate(foods, input, food.id)}
              onSubmit={(input: FoodInput) => onSave({ ...food, ...input })}
            />
            <RemoveSection
              key={`remove-${food.id}`}
              food={food}
              entryCount={entryCount}
              loaded={counts !== undefined}
              onRemove={onRemove}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
