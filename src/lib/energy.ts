// Australian labels give energy in kilojoules; the app stores whole kilocalories (Calories).
export const KILOJOULES_PER_CALORIE = 4.184;

// The largest whole kJ that still converts to at most 9,999 kcal, the cap on a Food's Calories.
export const MAX_KILOJOULES = 41837;

export const kilojoulesToCalories = (kilojoules: number) =>
  Math.round(kilojoules / KILOJOULES_PER_CALORIE);

export const caloriesToKilojoules = (calories: number) =>
  Math.round(calories * KILOJOULES_PER_CALORIE);

// Whole kilojoules typed by a person, or null if it isn't a usable number.
export function parseKilojoules(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= MAX_KILOJOULES ? value : null;
}
