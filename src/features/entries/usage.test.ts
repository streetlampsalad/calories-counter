import { describe, expect, it } from "vitest";
import type { Food } from "@/features/foods/types";
import {
  type FoodUsage,
  rankFoodsByUsage,
  recentFoods,
  USAGE_WINDOW_DAYS,
} from "./usage";

const food = (name: string): Food => ({
  id: name,
  name,
  portion: "1 serve",
  calories: 100,
  archivedAt: null,
});
const usage = (
  foodId: string,
  entryCount: number,
  lastLoggedAt: string,
): FoodUsage => ({
  foodId,
  entryCount,
  lastLoggedAt,
});

describe("rankFoodsByUsage", () => {
  it("puts the most-logged Foods first", () => {
    const foods = [food("Apple"), food("Banana"), food("Cheese")];
    const ranked = rankFoodsByUsage(foods, [
      usage("Cheese", 9, "2026-11-01T00:00:00Z"),
      usage("Banana", 2, "2026-11-02T00:00:00Z"),
    ]);

    expect(ranked.map((f) => f.name)).toEqual(["Cheese", "Banana", "Apple"]);
  });

  it("breaks ties alphabetically", () => {
    const foods = [food("Cherry"), food("Apple"), food("Banana")];
    const ranked = rankFoodsByUsage(foods, [
      usage("Cherry", 3, "2026-11-01T00:00:00Z"),
      usage("Apple", 3, "2026-11-01T00:00:00Z"),
      usage("Banana", 3, "2026-11-01T00:00:00Z"),
    ]);

    expect(ranked.map((f) => f.name)).toEqual(["Apple", "Banana", "Cherry"]);
  });

  it("lists never-logged Foods after the logged ones, alphabetically", () => {
    const foods = [food("Zucchini"), food("Apple"), food("Mango")];
    const ranked = rankFoodsByUsage(foods, [
      usage("Zucchini", 1, "2026-11-01T00:00:00Z"),
    ]);

    expect(ranked.map((f) => f.name)).toEqual(["Zucchini", "Apple", "Mango"]);
  });

  it("is simply alphabetical when there is no history", () => {
    const ranked = rankFoodsByUsage([food("b"), food("a")], []);

    expect(ranked.map((f) => f.name)).toEqual(["a", "b"]);
  });

  it("ignores usage for Foods that are not in the list, such as Archived ones", () => {
    const ranked = rankFoodsByUsage(
      [food("Apple")],
      [usage("Archived pie", 50, "2026-11-01T00:00:00Z")],
    );

    expect(ranked.map((f) => f.name)).toEqual(["Apple"]);
  });

  it("does not change the list it is given", () => {
    const foods = [food("b"), food("a")];
    rankFoodsByUsage(foods, []);

    expect(foods.map((f) => f.name)).toEqual(["b", "a"]);
  });
});

describe("recentFoods", () => {
  it("lists the Foods logged most recently first", () => {
    const foods = [food("Apple"), food("Banana"), food("Cheese")];
    const recent = recentFoods(foods, [
      usage("Apple", 1, "2026-11-01T08:00:00Z"),
      usage("Cheese", 1, "2026-11-03T08:00:00Z"),
      usage("Banana", 1, "2026-11-02T08:00:00Z"),
    ]);

    expect(recent.map((f) => f.name)).toEqual(["Cheese", "Banana", "Apple"]);
  });

  it("shows at most eight", () => {
    const foods = Array.from({ length: 12 }, (_, i) =>
      food(`Food ${String(i).padStart(2, "0")}`),
    );
    const recent = recentFoods(
      foods,
      foods.map((f, i) =>
        usage(f.id, 1, `2026-11-${String(i + 1).padStart(2, "0")}T00:00:00Z`),
      ),
    );

    expect(recent).toHaveLength(8);
    expect(recent[0].name).toBe("Food 11");
    expect(recent[7].name).toBe("Food 04");
  });

  it("leaves out Foods that were never logged, and Foods no longer in the list", () => {
    const recent = recentFoods(
      [food("Apple"), food("Never")],
      [
        usage("Apple", 1, "2026-11-01T00:00:00Z"),
        usage("Gone", 1, "2026-11-02T00:00:00Z"),
      ],
    );

    expect(recent.map((f) => f.name)).toEqual(["Apple"]);
  });

  it("is empty when nothing has been logged", () => {
    expect(recentFoods([food("Apple")], [])).toEqual([]);
  });
});

describe("USAGE_WINDOW_DAYS", () => {
  it("looks back 90 days", () => {
    expect(USAGE_WINDOW_DAYS).toBe(90);
  });
});
