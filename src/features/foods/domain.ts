import type { Food, FoodRow } from "./types";
import { normalizeText } from "./validation";

const collator = new Intl.Collator("en-AU", {
  sensitivity: "base",
  numeric: true,
});

export const toFood = (row: FoodRow): Food => ({
  id: row.id,
  name: row.name,
  portion: row.portion,
  calories: row.calories,
  archivedAt: row.archived_at,
});

export function sortFoods(foods: readonly Food[]): Food[] {
  return [...foods].sort(
    (a, b) =>
      collator.compare(a.name, b.name) ||
      collator.compare(a.portion, b.portion),
  );
}

const key = (name: string, portion: string) =>
  `${normalizeText(name).toLowerCase()}|${normalizeText(portion).toLowerCase()}`;

// Mirrors the database's unique index: one live Food per name and Portion, ignoring case.
export function findDuplicate(
  foods: readonly Food[],
  candidate: { name: string; portion: string },
  excludeId?: string,
): Food | undefined {
  const wanted = key(candidate.name, candidate.portion);
  return foods.find(
    (food) =>
      food.archivedAt === null &&
      food.id !== excludeId &&
      key(food.name, food.portion) === wanted,
  );
}

export const formatCalories = (calories: number) =>
  `${calories.toLocaleString("en-AU")} kcal`;

export const formatFoodDetail = (food: Pick<Food, "portion" | "calories">) =>
  `${food.portion} · ${formatCalories(food.calories)}`;
