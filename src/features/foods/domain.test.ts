import { describe, expect, it } from "vitest";
import {
  filterFoods,
  findDuplicate,
  formatCalories,
  formatFoodDetail,
  matchesFoodQuery,
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

describe("matchesFoodQuery", () => {
  const toast = food({ name: "Sourdough toast", portion: "1 slice" });
  const latte = food({ name: "Café latte", portion: "250 ml" });

  it("matches everything when the query is empty", () => {
    expect(matchesFoodQuery(toast, "")).toBe(true);
    expect(matchesFoodQuery(toast, "   ")).toBe(true);
  });

  it("matches the start of any word in the name", () => {
    expect(matchesFoodQuery(toast, "toa")).toBe(true);
    expect(matchesFoodQuery(toast, "sour")).toBe(true);
  });

  it("does not match the middle of a word", () => {
    expect(matchesFoodQuery(toast, "oast")).toBe(false);
    expect(matchesFoodQuery(toast, "dough")).toBe(false);
  });

  it("ignores case and accents in both directions", () => {
    expect(matchesFoodQuery(latte, "cafe")).toBe(true);
    expect(matchesFoodQuery(latte, "CAFÉ")).toBe(true);
    expect(matchesFoodQuery(food({ name: "Cafe au lait" }), "café")).toBe(true);
  });

  it("needs every typed word to match some word", () => {
    expect(matchesFoodQuery(toast, "sour toa")).toBe(true);
    expect(matchesFoodQuery(toast, "toa sour")).toBe(true);
    expect(matchesFoodQuery(toast, "sour latte")).toBe(false);
  });

  it("also searches the Portion", () => {
    expect(matchesFoodQuery(toast, "slice")).toBe(true);
    expect(matchesFoodQuery(latte, "250")).toBe(true);
  });

  it("is not thrown by punctuation or extra spaces", () => {
    expect(
      matchesFoodQuery(food({ name: "Mac & cheese" }), "  mac   chee "),
    ).toBe(true);
    expect(
      matchesFoodQuery(food({ name: "Arnott's Tim Tam" }), "arnott's"),
    ).toBe(true);
  });
});

describe("filterFoods", () => {
  it("keeps the list order and returns only matches", () => {
    const foods = [
      food({ name: "Apple" }),
      food({ name: "Banana" }),
      food({ name: "Apple pie" }),
    ];

    expect(filterFoods(foods, "app").map((f) => f.name)).toEqual([
      "Apple",
      "Apple pie",
    ]);
  });

  it("returns the same list for an empty query", () => {
    const foods = [food({ name: "Apple" })];

    expect(filterFoods(foods, "")).toBe(foods);
  });
});
