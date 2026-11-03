import type { FoodInput } from "./types";

export type FoodFormValues = {
  name: string;
  portion: string;
  calories: string;
};
export type FoodErrors = Partial<Record<keyof FoodFormValues, string>>;
export type FoodParseResult =
  | { ok: true; value: FoodInput }
  | { ok: false; errors: FoodErrors };

export const MAX_NAME = 80;
export const MAX_PORTION = 40;
export const MAX_CALORIES = 9999;

export const normalizeText = (text: string) => text.trim().replace(/\s+/g, " ");

// The database enforces the same limits; this gives the User a message instead of a constraint error.
export function parseFoodInput(raw: FoodFormValues): FoodParseResult {
  const name = normalizeText(raw.name);
  const portion = normalizeText(raw.portion);
  const caloriesText = raw.calories.trim();
  const errors: FoodErrors = {};

  if (!name) errors.name = "Enter a name";
  else if (name.length > MAX_NAME)
    errors.name = `Name must be ${MAX_NAME} characters or fewer`;

  if (!portion) errors.portion = "Enter a portion, like 1 slice or 100 g";
  else if (portion.length > MAX_PORTION) {
    errors.portion = `Portion must be ${MAX_PORTION} characters or fewer`;
  }

  const calories = /^\d+$/.test(caloriesText)
    ? Number(caloriesText)
    : Number.NaN;
  if (!(calories >= 0 && calories <= MAX_CALORIES)) {
    errors.calories = "Calories must be a whole number from 0 to 9,999";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, portion, calories } };
}
