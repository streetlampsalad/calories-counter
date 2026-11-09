// The part of a Food an Entry needs. Includes Archived Foods: history keeps counting them.
import type { MealTime } from "./meal-time";

export type EntryFood = {
  id: string;
  name: string;
  portion: string;
  calories: number;
};

// A User ate `quantity` Portions of `food` on `day` (a calendar date, YYYY-MM-DD, no time zone).
export type Entry = {
  id: string;
  day: string;
  quantity: number;
  createdAt: string;
  /** Optional tag (spec 174); stored even while the Toggle is off. */
  mealTime?: MealTime | null;
  food: EntryFood;
};
