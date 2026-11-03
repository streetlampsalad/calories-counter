"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { findDuplicate } from "@/features/foods/domain";
import { FoodForm } from "@/features/foods/food-form";
import type { Food, FoodInput } from "@/features/foods/types";
import type { Suggestion } from "./suggestions";

type Props = {
  suggestion: Suggestion | null;
  foods: readonly Food[];
  onSave: (food: FoodInput) => void;
  onEditExisting: (food: Food) => void;
  onClose: () => void;
};

// The Food form, opened with a Suggestion's values and where they came from. Everything stays editable.
export function SuggestionSheet({
  suggestion,
  foods,
  onSave,
  onEditExisting,
  onClose,
}: Props) {
  const per100 = suggestion?.per100;

  return (
    <Sheet
      open={suggestion !== null}
      onOpenChange={(next) => !next && onClose()}
    >
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add this food</SheetTitle>
          <SheetDescription>
            Check the values, change the portion if you eat a different amount,
            then save.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {suggestion ? (
            <FoodForm
              key={suggestion.key}
              initialValues={{
                name: suggestion.name,
                portion: per100 ? `100 ${per100.unit}` : "",
                calories: per100 ? String(per100.calories) : "",
              }}
              sourceLabel={suggestion.sourceLabel}
              findExisting={(input) => findDuplicate(foods, input)}
              onEditExisting={onEditExisting}
              onSubmit={(input) => {
                onSave(input);
                onClose();
              }}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
