import { describe, expect, it } from "vitest";
import {
  findDuplicate,
  formatCalories,
  formatFoodDetail,
  sortFoods,
} from "./domain";
import type { Food } from "./types";

const food = (overrides: Partial<Food> & Pick<Food, "name">): Food => ({
  id: crypto.randomUUID(),
  portion: "1 serve",
  calories: 100,
  archivedAt: null,
  ...overrides,
});

describe("sortFoods", () => {
  it("sorts alphabetically, ignoring case and accents", () => {
    const sorted = sortFoods([
      food({ name: "banana" }),
      food({ name: "Éclair" }),
      food({ name: "Apple" }),
      food({ name: "cheese" }),
    ]);

    expect(sorted.map((f) => f.name)).toEqual([
      "Apple",
      "banana",
      "cheese",
      "Éclair",
    ]);
  });

  it("orders the same name by Portion, treating numbers naturally", () => {
    const sorted = sortFoods([
      food({ name: "Rice", portion: "100 g" }),
      food({ name: "Rice", portion: "20 g" }),
      food({ name: "Rice", portion: "1 cup" }),
    ]);

    expect(sorted.map((f) => f.portion)).toEqual(["1 cup", "20 g", "100 g"]);
  });

  it("does not change the list it is given", () => {
    const original = [food({ name: "b" }), food({ name: "a" })];
    sortFoods(original);

    expect(original.map((f) => f.name)).toEqual(["b", "a"]);
  });
});

describe("findDuplicate", () => {
  const foods = [
    food({ name: "Sourdough toast", portion: "1 slice" }),
    food({ name: "Rice", portion: "100 g" }),
  ];

  it("matches name and Portion ignoring case and surrounding spaces", () => {
    expect(
      findDuplicate(foods, { name: "  SOURDOUGH toast ", portion: "1 SLICE" }),
    ).toBe(foods[0]);
  });

  it("treats the same name with a different Portion as a different Food", () => {
    expect(
      findDuplicate(foods, { name: "Sourdough toast", portion: "2 slices" }),
    ).toBeUndefined();
  });

  it("can ignore the Food being edited", () => {
    expect(
      findDuplicate(foods, { name: "Rice", portion: "100 g" }, foods[1].id),
    ).toBeUndefined();
  });

  it("ignores Archived Foods, which do not block a new one", () => {
    const withArchived = [
      ...foods,
      food({ name: "Pie", portion: "1 slice", archivedAt: "2026-01-01" }),
    ];

    expect(
      findDuplicate(withArchived, { name: "Pie", portion: "1 slice" }),
    ).toBeUndefined();
  });
});

describe("formatting", () => {
  it("formats calories with thousands separators", () => {
    expect(formatCalories(110)).toBe("110 kcal");
    expect(formatCalories(1200)).toBe("1,200 kcal");
    expect(formatCalories(0)).toBe("0 kcal");
  });

  it("describes a Food by Portion and calories", () => {
    expect(
      formatFoodDetail(
        food({ name: "Sourdough toast", portion: "1 slice", calories: 110 }),
      ),
    ).toBe("1 slice · 110 kcal");
  });
});
