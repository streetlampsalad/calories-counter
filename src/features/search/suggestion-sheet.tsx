"use client";

import { useState } from "react";
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
import { MAX_PORTION } from "@/features/foods/validation";
import type { Suggestion } from "./suggestions";

type Props = {
  suggestion: Suggestion | null;
  foods: readonly Food[];
  onSave: (food: FoodInput) => void;
  onEditExisting: (food: Food) => void;
  onClose: () => void;
};

type Basis = "serving" | "per100";

const kcal = (calories: number) => `${calories.toLocaleString("en-AU")} kcal`;

// "1 serving (30 g)", kept within what a Portion may hold.
const servingPortion = (label: string) =>
  `1 serving (${label})`.slice(0, MAX_PORTION);

function BasisChoice({
  suggestion,
  onChoose,
}: {
  suggestion: Suggestion & {
    per100: NonNullable<Suggestion["per100"]>;
    serving: NonNullable<Suggestion["serving"]>;
  };
  onChoose: (basis: Basis) => void;
}) {
  const option = (basis: Basis, title: string, detail: string) => (
    <button
      type="button"
      onClick={() => onChoose(basis)}
      className="flex min-h-16 w-full flex-col items-start justify-center rounded-lg border px-4 text-left"
    >
      <span className="font-medium">{title}</span>
      <span className="text-muted-foreground text-sm">{detail}</span>
    </button>
  );
  return (
    <div className="flex flex-col gap-3">
      <p className="font-medium">{suggestion.name}</p>
      <p className="text-muted-foreground text-sm">
        This product gives both. Which do you want to save?
      </p>
      {option(
        "serving",
        "Per serving",
        `${suggestion.serving.label}: ${kcal(suggestion.serving.calories)}`,
      )}
      {option(
        "per100",
        `Per 100 ${suggestion.per100.unit}`,
        kcal(suggestion.per100.calories),
      )}
    </div>
  );
}

// Holds the per-serving or per-100 choice for one Suggestion; keyed, so a new Suggestion starts fresh.
function SuggestionBody({
  suggestion,
  foods,
  onSave,
  onEditExisting,
  onClose,
}: Props & { suggestion: Suggestion }) {
  const { per100, serving } = suggestion;
  const [chosen, setChosen] = useState<Basis | null>(null);
  const basis: Basis | null =
    chosen ??
    (per100 && serving ? null : serving && !per100 ? "serving" : "per100");

  if (per100 && serving && basis === null) {
    return (
      <BasisChoice
        suggestion={{ ...suggestion, per100, serving }}
        onChoose={setChosen}
      />
    );
  }

  const initialValues =
    basis === "serving" && serving
      ? {
          name: suggestion.name,
          portion: servingPortion(serving.label),
          calories: String(serving.calories),
        }
      : per100
        ? {
            name: suggestion.name,
            portion: `100 ${per100.unit}`,
            calories: String(per100.calories),
          }
        : {
            name: suggestion.name,
            portion: suggestion.portion ?? "",
            calories:
              suggestion.calories === undefined
                ? ""
                : String(suggestion.calories),
          };

  return (
    <FoodForm
      initialValues={initialValues}
      sourceLabel={suggestion.sourceLabel}
      scaleFrom={basis === "per100" ? per100 : undefined}
      findExisting={(input) => findDuplicate(foods, input)}
      onEditExisting={onEditExisting}
      onSubmit={(input) => {
        onSave(input);
        onClose();
      }}
    />
  );
}

// The Food form, opened with a Suggestion's values and where they came from. Everything stays editable.
export function SuggestionSheet(props: Props) {
  const { suggestion, onClose } = props;

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
            <SuggestionBody
              key={suggestion.key}
              {...props}
              suggestion={suggestion}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
