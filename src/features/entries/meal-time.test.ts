import { describe, expect, it } from "vitest";
import {
  defaultMealTime,
  groupByMealTime,
  MEAL_TIMES,
  type MealTime,
  mealTimeLabel,
} from "./meal-time";

const at = (hours: number, minutes: number) =>
  new Date(2026, 10, 3, hours, minutes);

describe("MEAL_TIMES", () => {
  it("are breakfast, lunch, dinner and snack, in that order", () => {
    expect(MEAL_TIMES).toEqual(["breakfast", "lunch", "dinner", "snack"]);
    expect(MEAL_TIMES.map(mealTimeLabel)).toEqual([
      "Breakfast",
      "Lunch",
      "Dinner",
      "Snack",
    ]);
  });
});

describe("defaultMealTime", () => {
  it.each([
    [0, 0, "breakfast"],
    [10, 29, "breakfast"],
    [10, 30, "lunch"],
    [14, 59, "lunch"],
    [15, 0, "snack"],
    [16, 59, "snack"],
    [17, 0, "dinner"],
    [23, 59, "dinner"],
  ] as const)("is %i:%i -> %s", (h, m, expected) => {
    expect(defaultMealTime(at(h, m))).toBe(expected);
  });
});

type Item = { id: string; mealTime: MealTime | null; kcal: number };
const item = (id: string, mealTime: MealTime | null, kcal: number): Item => ({
  id,
  mealTime,
  kcal,
});
const group = (items: Item[]) =>
  groupByMealTime(
    items,
    (i) => i.mealTime,
    (i) => i.kcal,
  );

describe("groupByMealTime", () => {
  it("orders groups Breakfast, Lunch, Dinner, Snacks, Other and keeps newest first within each", () => {
    const groups = group([
      item("o1", null, 10),
      item("s1", "snack", 10),
      item("d1", "dinner", 10),
      item("l2", "lunch", 10),
      item("l1", "lunch", 10),
      item("b1", "breakfast", 10),
    ]);

    expect(groups.map((g) => g.heading)).toEqual([
      "Breakfast",
      "Lunch",
      "Dinner",
      "Snacks",
      "Other",
    ]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["l2", "l1"]);
  });

  it("sums each group once, rounding the exact total", () => {
    const groups = group([
      item("a", "lunch", 27.5),
      item("b", "lunch", 27.5),
      item("c", "dinner", 300),
    ]);

    expect(groups.map((g) => g.calories)).toEqual([55, 300]);
  });

  it("leaves out a Meal time with no Entries", () => {
    const groups = group([item("a", "dinner", 1), item("b", null, 1)]);

    expect(groups.map((g) => g.key)).toEqual(["dinner", "other"]);
  });

  it("gives no groups when no Entry has a Meal time", () => {
    expect(group([item("a", null, 1), item("b", null, 2)])).toEqual([]);
    expect(group([])).toEqual([]);
  });
});
