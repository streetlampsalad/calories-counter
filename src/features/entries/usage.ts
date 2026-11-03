import type { Food } from "@/features/foods/types";

// How far back "most logged" and "recent" look (spec 008).
export const USAGE_WINDOW_DAYS = 90;
export const RECENT_LIMIT = 8;

export type FoodUsage = {
  foodId: string;
  entryCount: number;
  lastLoggedAt: string;
};

const collator = new Intl.Collator("en-AU", {
  sensitivity: "base",
  numeric: true,
});

// Most-logged first, ties alphabetical; Foods never logged follow, alphabetical.
// Usage for Foods not in `foods` (Archived ones, say) is ignored.
export function rankFoodsByUsage(
  foods: readonly Food[],
  usage: readonly FoodUsage[],
): Food[] {
  const counts = new Map(usage.map((u) => [u.foodId, u.entryCount]));
  return [...foods].sort(
    (a, b) =>
      (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
      collator.compare(a.name, b.name) ||
      collator.compare(a.portion, b.portion),
  );
}

// The Foods logged most recently, newest first, at most RECENT_LIMIT.
export function recentFoods(
  foods: readonly Food[],
  usage: readonly FoodUsage[],
): Food[] {
  const byId = new Map(foods.map((food) => [food.id, food]));
  return [...usage]
    .sort((a, b) => Date.parse(b.lastLoggedAt) - Date.parse(a.lastLoggedAt))
    .flatMap((u) => byId.get(u.foodId) ?? [])
    .slice(0, RECENT_LIMIT);
}
