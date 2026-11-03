"use client";

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
  onClose: () => void;
};

function entriesWarning(count: number) {
  const noun = count === 1 ? "Entry" : "Entries";
  return `Changing this updates ${count.toLocaleString("en-AU")} past ${noun}`;
}

export function EditFoodSheet({ food, foods, onSave, onClose }: Props) {
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
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
