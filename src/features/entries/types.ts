// The part of a Food an Entry needs. Includes Archived Foods: history keeps counting them.
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
  food: EntryFood;
};
