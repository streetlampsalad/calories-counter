import { formatCalories } from "@/features/foods/domain";
import { dayLabel, isPlanned } from "./days";
import type { Entry } from "./types";

export const QUANTITY_STEP = 0.5;
export const MIN_QUANTITY = 0.5;
export const MAX_QUANTITY = 20;
// One-tap choices in the picker; the stepper covers everything else.
export const QUANTITY_PRESETS = [0.5, 1, 1.5, 2, 3] as const;

// 0.5 -> "½", 1.5 -> "1½", 2 -> "2"
export function formatQuantity(quantity: number): string {
  const whole = Math.floor(quantity);
  const half = quantity - whole === 0.5;
  if (whole === 0 && !half) return "0";
  return `${whole === 0 ? "" : whole}${half ? "½" : ""}`;
}

// Entries store no calories: they always come from the Food as it is now (ADR 0001).
const exactCalories = (entry: Entry) => entry.quantity * entry.food.calories;

export const entryCalories = (entry: Entry) => Math.round(exactCalories(entry));

// Rounds the exact sum once, so two half-portions of a 55 kcal Food are 55, not 28 + 28.
export const dailyTotal = (entries: readonly Entry[]) =>
  Math.round(entries.reduce((sum, entry) => sum + exactCalories(entry), 0));

export const formatEntryDetail = (entry: Entry) =>
  `${formatQuantity(entry.quantity)} × ${entry.food.portion} · ${formatCalories(entryCalories(entry))}`;

// The toast after logging: a Planned Entry says so, and for which Day.
export function addedMessage(
  foodName: string,
  quantity: number,
  day: string,
  today: string,
): string {
  const what = `${formatQuantity(quantity)} × ${foodName}`;
  if (!isPlanned(day, today)) return `Added ${what}`;
  const label = dayLabel(day, today);
  return `Planned ${what} for ${label === "Tomorrow" ? "tomorrow" : label}`;
}

export function stepQuantity(quantity: number, direction: 1 | -1): number {
  const next = quantity + direction * QUANTITY_STEP;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, next));
}
