import { describe, expect, it } from "vitest";
import { listDays } from "@/features/entries/days";
import type { PeriodRange } from "./period";
import type { DayTotal } from "./summarise";
import {
  buildTrend,
  hasEnoughData,
  MIN_LOGGED_DAYS,
  rollingAverage,
  trendHeadline,
} from "./trend";

const range = (from: string, to: string): PeriodRange => ({
  from,
  to,
  days: listDays(from, to),
});
const day = (date: string, calories: number): DayTotal => ({
  day: date,
  calories,
  entryCount: 1,
});

describe("rollingAverage", () => {
  const TEN = range("2026-10-01", "2026-10-10");

  it("averages the Days logged in the 7 Days up to each Day", () => {
    const totals = TEN.days.map((d) => day(d, 2000));
    const points = rollingAverage(totals, TEN);

    expect(points).toHaveLength(10);
    expect(points[6]).toEqual({ day: "2026-10-07", average: 2000 });
  });

  it("starts only once a full 7-Day window exists", () => {
    const points = rollingAverage(
      TEN.days.map((d) => day(d, 2000)),
      TEN,
    );

    expect(points.slice(0, 6).every((p) => p.average === null)).toBe(true);
    expect(points[6].average).not.toBeNull();
  });

  it("follows a change: the window slides one Day at a time", () => {
    // 7 Days at 2,000 then one at 2,700: the 8th window drops the first 2,000 and adds 2,700.
    const totals = [
      ...TEN.days.slice(0, 7).map((d) => day(d, 2000)),
      day("2026-10-08", 2700),
    ];
    const points = rollingAverage(totals, TEN);

    expect(points[6].average).toBe(2000);
    expect(points[7].average).toBe(Math.round((6 * 2000 + 2700) / 7));
  });

  it("does not count a Day with nothing logged as zero", () => {
    // Only 3 of the 7 Days are logged, all 2,100: the average is 2,100, not 900.
    const totals = [
      day("2026-10-02", 2100),
      day("2026-10-04", 2100),
      day("2026-10-07", 2100),
    ];
    const points = rollingAverage(totals, TEN);

    expect(points[6].average).toBe(2100);
  });

  it("leaves a gap where a whole window has nothing logged", () => {
    const points = rollingAverage(
      [day("2026-10-01", 2000)],
      range("2026-10-01", "2026-10-20"),
    );

    expect(points[6].average).toBe(2000);
    expect(points[7].average).toBeNull();
    expect(points[19].average).toBeNull();
  });

  it("has no averages for a Period shorter than the window", () => {
    const short = range("2026-10-01", "2026-10-05");
    const points = rollingAverage(
      short.days.map((d) => day(d, 2000)),
      short,
    );

    expect(points.every((p) => p.average === null)).toBe(true);
  });

  it("ignores Days with no Entries", () => {
    const totals = [
      ...TEN.days.slice(0, 6).map((d) => day(d, 2000)),
      { day: "2026-10-07", calories: 0, entryCount: 0 },
    ];

    expect(rollingAverage(totals, TEN)[6].average).toBe(2000);
  });
});

describe("hasEnoughData", () => {
  it("needs at least 7 logged Days in the Period", () => {
    expect(MIN_LOGGED_DAYS).toBe(7);
    const six = listDays("2026-10-01", "2026-10-06").map((d) => day(d, 2000));
    const seven = listDays("2026-10-01", "2026-10-07").map((d) => day(d, 2000));
    const period = range("2026-10-01", "2026-10-31");

    expect(hasEnoughData(six, period)).toBe(false);
    expect(hasEnoughData(seven, period)).toBe(true);
  });

  it("ignores Days outside the Period, and Days with no Entries", () => {
    const period = range("2026-10-10", "2026-10-31");
    const outside = listDays("2026-10-01", "2026-10-09").map((d) =>
      day(d, 2000),
    );
    const empty = listDays("2026-10-10", "2026-10-20").map((d) => ({
      day: d,
      calories: 0,
      entryCount: 0,
    }));

    expect(hasEnoughData([...outside, ...empty], period)).toBe(false);
  });
});

describe("trendHeadline", () => {
  const points = (first: number | null, last: number | null) => [
    { day: "2026-08-12", average: first },
    { day: "2026-09-01", average: 2000 },
    { day: "2026-11-03", average: last },
  ];

  it("says the average is down, by how much, and since when", () => {
    expect(trendHeadline(points(2300, 2180))).toBe(
      "Your 7-day average is down 120 kcal since 12 Aug",
    );
  });

  it("says the average is up", () => {
    expect(trendHeadline(points(1900, 2150))).toBe(
      "Your 7-day average is up 250 kcal since 12 Aug",
    );
  });

  it("calls a small change steady rather than reporting noise", () => {
    expect(trendHeadline(points(2000, 2020))).toBe(
      "Your 7-day average is steady at 2,020 kcal",
    );
    expect(trendHeadline(points(2000, 1980))).toBe(
      "Your 7-day average is steady at 1,980 kcal",
    );
  });

  it("uses thousands separators", () => {
    expect(trendHeadline(points(1000, 3500))).toBe(
      "Your 7-day average is up 2,500 kcal since 12 Aug",
    );
  });

  it("compares the first and last Days that have an average", () => {
    expect(
      trendHeadline([
        { day: "2026-10-01", average: null },
        { day: "2026-10-07", average: 2000 },
        { day: "2026-10-20", average: 1800 },
        { day: "2026-10-25", average: null },
      ]),
    ).toBe("Your 7-day average is down 200 kcal since 7 Oct");
  });

  it("has nothing to say without two points to compare", () => {
    expect(trendHeadline([])).toBeNull();
    expect(trendHeadline([{ day: "2026-10-07", average: 2000 }])).toBeNull();
    expect(
      trendHeadline([
        { day: "a", average: null },
        { day: "b", average: null },
      ]),
    ).toBeNull();
  });
});

describe("buildTrend", () => {
  const two = [
    { day: "a", average: 1000 },
    { day: "b", average: 2000 },
  ];

  it("draws one line through the averages, padded so it does not touch the edges", () => {
    const trend = buildTrend(two, null);

    expect(trend.segments).toHaveLength(1);
    expect(trend.lo).toBeLessThan(1000);
    expect(trend.hi).toBeGreaterThan(2000);
    expect(trend.segments[0]).toMatch(/^M0,[\d.]+ L100,[\d.]+$/);
  });

  it("puts higher values higher up (a smaller y)", () => {
    const trend = buildTrend(two, null);
    const ys = trend.segments[0]
      .replace(/[ML]/g, "")
      .split(" ")
      .map((p) => Number(p.split(",")[1]));

    expect(ys[1]).toBeLessThan(ys[0]);
  });

  it("breaks the line at a gap rather than drawing across it", () => {
    const trend = buildTrend(
      [
        { day: "a", average: 2000 },
        { day: "b", average: 2100 },
        { day: "c", average: null },
        { day: "d", average: 1900 },
        { day: "e", average: 1950 },
      ],
      null,
    );

    expect(trend.segments).toHaveLength(2);
  });

  it("makes room for the Goal line", () => {
    const trend = buildTrend(
      [
        { day: "a", average: 1500 },
        { day: "b", average: 1600 },
      ],
      3000,
    );

    expect(trend.hi).toBeGreaterThanOrEqual(3000);
    expect(trend.goalPct).not.toBeNull();
  });

  it("has no Goal line without a Goal", () => {
    expect(buildTrend(two, null).goalPct).toBeNull();
  });

  it("reports the latest average, for a direct label", () => {
    const trend = buildTrend(two, null);

    expect(trend.last).toMatchObject({ day: "b", average: 2000 });
    expect(trend.last?.pct).toBeGreaterThan(0);
  });

  it("copes with a flat line", () => {
    const trend = buildTrend(
      [
        { day: "a", average: 2000 },
        { day: "b", average: 2000 },
      ],
      null,
    );

    expect(trend.hi).toBeGreaterThan(trend.lo);
  });
});
