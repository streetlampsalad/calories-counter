"use client";

import { cn } from "@/lib/utils";
import { MEAL_TIMES, type MealTime, mealTimeLabel } from "./meal-time";

type Props = {
  value: MealTime | null;
  /** The tapped chip, or null when the chosen chip is tapped again. */
  onChange: (next: MealTime | null) => void;
};

// Four chips, at most one chosen; tapping the chosen one clears it (spec 174).
export function MealTimeChips({ value, onChange }: Props) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2 font-medium text-muted-foreground text-sm">
        Meal time
      </legend>
      <div className="flex flex-wrap gap-2">
        {MEAL_TIMES.map((mealTime) => {
          const selected = value === mealTime;
          return (
            <button
              key={mealTime}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : mealTime)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-foreground",
              )}
            >
              {mealTimeLabel(mealTime)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
