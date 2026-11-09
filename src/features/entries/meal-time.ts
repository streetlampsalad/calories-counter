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

// The Day's groups, in the order they are shown. "Other" holds Entries with no Meal time.
export type MealGroupKey = MealTime | "other";

export const MEAL_GROUP_ORDER: readonly MealGroupKey[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "other",
];

const GROUP_HEADINGS: Record<MealGroupKey, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
  other: "Other",
};

export const mealGroupHeading = (key: MealGroupKey) => GROUP_HEADINGS[key];

export type MealGroup<T> = {
  key: MealGroupKey;
  heading: string;
  items: T[];
  /** Quantity times current Food Calories, rounded once; never stored (ADR 0001). */
  calories: number;
};

// Groups items under their Meal time, keeping the order given within each group (newest first).
// Groups with no items are left out. When no item has a Meal time there is nothing to group, so
// the result is empty and the Day looks as it always did.
export function groupByMealTime<T>(
  items: readonly T[],
  mealTimeOf: (item: T) => MealTime | null | undefined,
  exactCaloriesOf: (item: T) => number,
): MealGroup<T>[] {
  if (!items.some((item) => mealTimeOf(item))) return [];
  const groups: MealGroup<T>[] = [];
  for (const key of MEAL_GROUP_ORDER) {
    const inGroup = items.filter(
      (item) => (mealTimeOf(item) ?? "other") === key,
    );
    if (inGroup.length === 0) continue;
    groups.push({
      key,
      heading: mealGroupHeading(key),
      items: inGroup,
      calories: Math.round(
        inGroup.reduce((sum, item) => sum + exactCaloriesOf(item), 0),
      ),
    });
  }
  return groups;
}
