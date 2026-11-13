import type { WeekStart } from "@/features/settings/domain";
import { type PeriodRange, periodRange } from "@/features/summary/period";

export const MIN_LOGGED_DAYS = 3;
// Keeps the request small: only the Foods with the most Calories over the week are sent.
export const MAX_FOODS = 80;

export type WeekSummary = {
  loggedDays: number;
  foods: {
    name: string;
    portion: string;
    calories: number;
    quantity: number;
  }[];
};

// Last week: the 7 Days before the start of this week (the `last-week` Period).
export const lastWeek = (today: string, weekStartsOn: WeekStart): PeriodRange =>
  periodRange("last-week", today, weekStartsOn);

// Whether the week has enough Logged Days to guess from, given its daily totals.
export const hasEnoughDays = (totals: { entryCount: number }[]): boolean =>
  totals.filter((total) => total.entryCount > 0).length >= MIN_LOGGED_DAYS;

export type WeekRow = {
  foodId: string;
  day: string;
  quantity: number;
  name: string;
  portion: string;
  calories: number;
};

// What Gemini is told about the week: per Food its name, Portion, Calories per Portion and total
// Quantity, biggest first. Nothing that identifies the User, and no ids.
export function summariseWeek(rows: WeekRow[]): WeekSummary {
  const byFood = new Map<string, WeekSummary["foods"][number]>();
  for (const row of rows) {
    const food = byFood.get(row.foodId);
    if (food) food.quantity += row.quantity;
    else {
      byFood.set(row.foodId, {
        name: row.name,
        portion: row.portion,
        calories: row.calories,
        quantity: row.quantity,
      });
    }
  }
  const foods = [...byFood.values()]
    .sort((a, b) => b.quantity * b.calories - a.quantity * a.calories)
    .slice(0, MAX_FOODS);
  return { loggedDays: new Set(rows.map((r) => r.day)).size, foods };
}
