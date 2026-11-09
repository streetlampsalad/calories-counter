// Meal time (spec 174): an optional tag on an Entry, fixed to these four.
export const MEAL_TIMES = ["breakfast", "lunch", "dinner", "snack"] as const;

export type MealTime = (typeof MEAL_TIMES)[number];

const LABELS: Record<MealTime, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export const mealTimeLabel = (mealTime: MealTime) => LABELS[mealTime];

export const isMealTime = (value: unknown): value is MealTime =>
  typeof value === "string" &&
  (MEAL_TIMES as readonly string[]).includes(value);

// The chip to pre-choose from the phone's clock. Used only to pre-choose; never stored.
export function defaultMealTime(now: Date): MealTime {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 10 * 60 + 30) return "breakfast";
  if (minutes < 15 * 60) return "lunch";
  if (minutes < 17 * 60) return "snack";
  return "dinner";
}
