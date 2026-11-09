import { describe, expect, it } from "vitest";
import { defaultMealTime, MEAL_TIMES, mealTimeLabel } from "./meal-time";

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
