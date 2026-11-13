import { describe, expect, it } from "vitest";
import {
  hasEnoughDays,
  lastWeek,
  MAX_FOODS,
  MIN_LOGGED_DAYS,
  summariseWeek,
} from "./week";

describe("lastWeek", () => {
  it("is the 7 Days before this week for weeks starting on Monday", () => {
    // 2026-11-13 is a Friday; this week started Monday 9 Nov.
    const week = lastWeek("2026-11-13", 1);
    expect(week.from).toBe("2026-11-02");
    expect(week.to).toBe("2026-11-08");
    expect(week.days).toHaveLength(7);
  });

  it("is the 7 Days before this week for weeks starting on Sunday", () => {
    const week = lastWeek("2026-11-13", 0);
    expect(week.from).toBe("2026-11-01");
    expect(week.to).toBe("2026-11-07");
  });
});

describe("hasEnoughDays", () => {
  const day = (d: string, entryCount = 1) => ({
    day: d,
    calories: 100,
    entryCount,
  });

  it("needs 3 Logged Days", () => {
    expect(MIN_LOGGED_DAYS).toBe(3);
    expect(hasEnoughDays([day("a"), day("b")])).toBe(false);
    expect(hasEnoughDays([day("a"), day("b"), day("c")])).toBe(true);
  });

  it("does not count a Day with no Entries", () => {
    expect(hasEnoughDays([day("a"), day("b"), day("c", 0)])).toBe(false);
  });
});

describe("summariseWeek", () => {
  const row = (
    foodId: string,
    day: string,
    quantity: number,
    name = foodId,
    calories = 100,
  ) => ({ foodId, day, quantity, name, portion: "1 serve", calories });

  it("sums Quantity per Food and counts the Logged Days", () => {
    const summary = summariseWeek([
      row("a", "2026-11-02", 1, "Salmon", 200),
      row("a", "2026-11-03", 2, "Salmon", 200),
      row("b", "2026-11-03", 1, "Rice", 150),
      row("b", "2026-11-04", 0.5, "Rice", 150),
    ]);

    expect(summary.loggedDays).toBe(3);
    expect(summary.foods).toEqual([
      { name: "Salmon", portion: "1 serve", calories: 200, quantity: 3 },
      { name: "Rice", portion: "1 serve", calories: 150, quantity: 1.5 },
    ]);
  });

  it("sends no ids", () => {
    const summary = summariseWeek([row("secret-id", "2026-11-02", 1)]);
    expect(JSON.stringify(summary)).not.toContain("secret-id");
  });

  it("keeps the Foods with the most Calories over the week", () => {
    const rows = Array.from({ length: MAX_FOODS + 5 }, (_, i) =>
      row(`f${i}`, "2026-11-02", 1, `Food ${i}`, i + 1),
    );
    const summary = summariseWeek(rows);

    expect(summary.foods).toHaveLength(MAX_FOODS);
    expect(summary.foods[0].name).toBe(`Food ${MAX_FOODS + 4}`);
    expect(summary.foods.map((f) => f.name)).not.toContain("Food 0");
  });
});
