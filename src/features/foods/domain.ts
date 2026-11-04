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

const foodsCount = (count: number) =>
  `${count} ${count === 1 ? "food" : "foods"}`;

// What removing several Foods at once will do, so the confirmation can say so (spec 014 AC-6).
// A Food with Entries is archived and one without is deleted (ADR 0001). Before the counts are
// known the split is not guessed; the server decides either way.
export function removalSummary(
  foods: readonly Food[],
  entryCounts: Readonly<Record<string, number>> | undefined,
): { title: string; description: string; confirmLabel: string } {
  const all = foodsCount(foods.length);
  if (!entryCounts) {
    return {
      title: `Remove ${all}?`,
      description: "Foods you've logged are archived. The rest are deleted.",
      confirmLabel: `Remove ${all}`,
    };
  }
  const archived = foods.filter(
    (food) => (entryCounts[food.id] ?? 0) > 0,
  ).length;
  const deleted = foods.length - archived;
  if (archived > 0 && deleted > 0) {
    return {
      title: `Remove ${all}?`,
      description: `${archived} you've logged will be archived, ${deleted} will be deleted.`,
      confirmLabel: `Remove ${all}`,
    };
  }
  if (archived > 0) {
    return {
      title: `Archive ${all}?`,
      description:
        "Archived foods leave your list, but past entries keep their calories. You can restore them from Archived foods.",
      confirmLabel: `Archive ${all}`,
    };
  }
  return {
    title: `Delete ${all}?`,
    description: `${foods.length === 1 ? "It has" : "They have"} no entries, so ${foods.length === 1 ? "it" : "they"} will be deleted for good.`,
    confirmLabel: `Delete ${all}`,
  };
}

export const foodKey = (name: string, portion: string) =>
  `${normalizeText(name).toLowerCase()}|${normalizeText(portion).toLowerCase()}`;

// Mirrors the database's unique index: one live Food per name and Portion, ignoring case.
export function findDuplicate(
  foods: readonly Food[],
  candidate: { name: string; portion: string },
  excludeId?: string,
): Food | undefined {
  const wanted = foodKey(candidate.name, candidate.portion);
  return foods.find(
    (food) =>
      food.archivedAt === null &&
      food.id !== excludeId &&
      foodKey(food.name, food.portion) === wanted,
  );
}

// Lower-case words with accents removed, so "Café" and "cafe" meet in the middle.
const words = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);

// Every typed word must start some word in the name or Portion.
export function matchesFoodQuery(
  food: Pick<Food, "name" | "portion">,
  query: string,
): boolean {
  const wanted = words(query);
  if (wanted.length === 0) return true;
  const available = words(`${food.name} ${food.portion}`);
  return wanted.every((word) =>
    available.some((candidate) => candidate.startsWith(word)),
  );
}

export function filterFoods(
  foods: readonly Food[],
  query: string,
): readonly Food[] {
  if (words(query).length === 0) return foods;
  return foods.filter((food) => matchesFoodQuery(food, query));
}

export const formatCalories = (calories: number) =>
  `${calories.toLocaleString("en-AU")} kcal`;

export const formatFoodDetail = (food: Pick<Food, "portion" | "calories">) =>
  `${food.portion} · ${formatCalories(food.calories)}`;
