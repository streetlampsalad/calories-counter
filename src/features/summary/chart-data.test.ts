import { describe, expect, it } from "vitest";
import { axisLabels, buildBars, niceMax } from "./chart-data";
import type { PeriodRange } from "./period";

const range = (days: string[]): PeriodRange => ({
  from: days[0],
  to: days.at(-1) ?? "",
  days,
});
const WEEK = range([
  "2026-10-26",
  "2026-10-27",
  "2026-10-28",
  "2026-10-29",
  "2026-10-30",
  "2026-10-31",
  "2026-11-01",
]);
const day = (date: string, calories: number, entryCount = 1) => ({
  day: date,
  calories,
  entryCount,
});

describe("niceMax", () => {
  it.each([
    [0, 100],
    [1, 100],
    [820, 1000],
    [1000, 1000],
    [1001, 1500],
    [2300, 2500],
    [2500, 2500],
    [2501, 3000],
    [7400, 7500],
    [9999, 10000],
  ])("rounds %i up to %i, a tidy top for the scale", (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });
});

describe("buildBars", () => {
  it("makes one slot per Day in the Period, in order", () => {
    const { bars } = buildBars([day("2026-10-27", 1800)], WEEK, null);

    expect(bars.map((b) => b.day)).toEqual(WEEK.days);
  });

  it("leaves a Day with nothing logged empty: not a zero bar", () => {
    const { bars } = buildBars([day("2026-10-27", 1800)], WEEK, null);

    expect(bars[0]).toMatchObject({
      logged: false,
      calories: null,
      heightPct: 0,
    });
    expect(bars[1]).toMatchObject({ logged: true, calories: 1800 });
  });

  it("scales bars against a tidy top, so the tallest is not clipped or flush", () => {
    const { bars, yMax } = buildBars(
      [day("2026-10-26", 2000), day("2026-10-27", 1000)],
      WEEK,
      null,
    );

    expect(yMax).toBe(2000);
    expect(bars[0].heightPct).toBe(100);
    expect(bars[1].heightPct).toBe(50);
  });

  it("makes room for the Goal even when every Day is under it", () => {
    const { yMax, goalPct } = buildBars([day("2026-10-26", 1000)], WEEK, 2200);

    expect(yMax).toBe(2500);
    expect(goalPct).toBe(88);
  });

  it("flags only Days past the Goal, not Days exactly on it", () => {
    const { bars } = buildBars(
      [
        day("2026-10-26", 2201),
        day("2026-10-27", 2200),
        day("2026-10-28", 1800),
      ],
      WEEK,
      2200,
    );

    expect(bars.map((b) => b.over)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("has no Goal line and flags nothing without a Goal", () => {
    const { bars, goalPct } = buildBars([day("2026-10-26", 9000)], WEEK, null);

    expect(goalPct).toBeNull();
    expect(bars.every((b) => !b.over)).toBe(true);
  });

  it("keeps a logged Day that totals zero visible as a sliver", () => {
    const { bars } = buildBars(
      [day("2026-10-26", 0, 2), day("2026-10-27", 1000)],
      WEEK,
      null,
    );

    expect(bars[0]).toMatchObject({ logged: true, calories: 0 });
    expect(bars[0].heightPct).toBeGreaterThan(0);
    expect(bars[0].heightPct).toBeLessThan(3);
  });

  it("ignores totals outside the Period", () => {
    const { bars } = buildBars(
      [day("2026-10-20", 9000), day("2026-10-26", 500)],
      WEEK,
      null,
    );

    expect(bars.filter((b) => b.logged)).toHaveLength(1);
  });

  it("copes with a Period where nothing was logged", () => {
    const { bars, yMax } = buildBars([], WEEK, null);

    expect(bars.every((b) => !b.logged)).toBe(true);
    expect(yMax).toBe(100);
  });
});

describe("axisLabels", () => {
  it("labels every Day of a week with its weekday letter", () => {
    expect(axisLabels(WEEK.days)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
  });

  it("labels a short Period fully too", () => {
    expect(axisLabels(["2026-11-02", "2026-11-03"])).toEqual(["M", "T"]);
  });

  it("labels a longer Period sparsely, so labels never collide", () => {
    const month = range(
      Array.from(
        { length: 30 },
        (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`,
      ),
    );
    const labels = axisLabels(month.days);

    expect(labels).toHaveLength(30);
    expect(labels.filter(Boolean).length).toBeLessThanOrEqual(7);
    expect(labels[0]).toBe("1 Oct");
  });

  it("marks the first of a month when a Period spans two", () => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 9, 5 + i));
      return d.toISOString().slice(0, 10);
    });
    const labels = axisLabels(days);

    expect(labels[days.indexOf("2026-11-01")]).toBe("1 Nov");
  });
});
