import { describe, expect, it } from "vitest";
import { type FoodTotal, TOP_LIMIT, topFoods } from "./top-foods";

const food = (
  name: string,
  calories: number,
  entryCount: number,
  archived = false,
): FoodTotal => ({
  foodId: name,
  name,
  portion: "1 serve",
  archived,
  calories,
  entryCount,
});

describe("topFoods", () => {
  const rows = [
    food("Rice", 260, 1),
    food("Toast", 660, 3),
    food("Pie", 300, 1, true),
    food("Apple", 80, 5),
  ];

  it("ranks by total calories by default, biggest first", () => {
    expect(topFoods(rows, "calories").map((f) => f.name)).toEqual([
      "Toast",
      "Pie",
      "Rice",
      "Apple",
    ]);
  });

  it("can rank by how often a Food was logged instead", () => {
    expect(topFoods(rows, "times").map((f) => f.name)).toEqual([
      "Apple",
      "Toast",
      "Pie",
      "Rice",
    ]);
  });

  it("breaks ties by calories, then by name", () => {
    const tied = [food("B", 100, 2), food("A", 100, 2), food("C", 300, 2)];

    expect(topFoods(tied, "times").map((f) => f.name)).toEqual(["C", "A", "B"]);
    expect(
      topFoods([food("B", 100, 1), food("A", 100, 1)], "calories").map(
        (f) => f.name,
      ),
    ).toEqual(["A", "B"]);
  });

  it("works out each Food's share of everything eaten in the Period", () => {
    // 660 + 300 + 260 + 80 = 1,300
    const shares = Object.fromEntries(
      topFoods(rows, "calories").map((f) => [f.name, f.sharePct]),
    );

    expect(shares).toEqual({ Toast: 51, Pie: 23, Rice: 20, Apple: 6 });
  });

  it("measures share against every Food, not just the ones shown", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      food(`Food ${i}`, 100, 1),
    );
    const top = topFoods(many, "calories");

    expect(top).toHaveLength(TOP_LIMIT);
    expect(top[0].sharePct).toBe(8); // 100 of 1,200
  });

  it("shows at most ten", () => {
    expect(TOP_LIMIT).toBe(10);
    expect(
      topFoods(
        Array.from({ length: 25 }, (_, i) => food(`F${i}`, 100 + i, 1)),
        "calories",
      ),
    ).toHaveLength(10);
  });

  it("keeps Archived Foods in, flagged", () => {
    const pie = topFoods(rows, "calories").find((f) => f.name === "Pie");

    expect(pie?.archived).toBe(true);
  });

  it("is empty when nothing was logged, with no division by zero", () => {
    expect(topFoods([], "calories")).toEqual([]);
    expect(topFoods([food("Water", 0, 3)], "calories")[0].sharePct).toBe(0);
  });

  it("does not change the rows it is given", () => {
    const original = [food("b", 1, 1), food("a", 2, 1)];
    topFoods(original, "calories");

    expect(original.map((f) => f.name)).toEqual(["b", "a"]);
  });
});
