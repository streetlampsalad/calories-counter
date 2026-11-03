import { describe, expect, it } from "vitest";
import { summarise } from "./summarise";

const range = (days: string[]) => ({
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

describe("summarise", () => {
  it("adds up the total and averages it over the Days actually logged", () => {
    const result = summarise(
      [
        day("2026-10-26", 2000),
        day("2026-10-27", 1800),
        day("2026-10-29", 2200),
      ],
      WEEK,
      null,
    );

    expect(result).toMatchObject({
      total: 6000,
      loggedDays: 3,
      daysInRange: 7,
      averagePerLoggedDay: 2000,
    });
  });

  it("does not count a Day with nothing logged as zero in the average", () => {
    const result = summarise([day("2026-10-26", 2000)], WEEK, null);

    expect(result.averagePerLoggedDay).toBe(2000);
    expect(result.loggedDays).toBe(1);
  });

  it("counts a Day with Entries as logged even when they total zero (water)", () => {
    const result = summarise(
      [day("2026-10-26", 0, 2), day("2026-10-27", 1000)],
      WEEK,
      null,
    );

    expect(result.loggedDays).toBe(2);
    expect(result.averagePerLoggedDay).toBe(500);
  });

  it("rounds the average to a whole number, halves up", () => {
    expect(
      summarise([day("2026-10-26", 1001), day("2026-10-27", 1000)], WEEK, null)
        .averagePerLoggedDay,
    ).toBe(1001);
    expect(
      summarise(
        [
          day("2026-10-26", 1000),
          day("2026-10-27", 1001),
          day("2026-10-28", 1000),
        ],
        WEEK,
        null,
      ).averagePerLoggedDay,
    ).toBe(1000);
  });

  it("has no average, and a zero total, when nothing was logged", () => {
    expect(summarise([], WEEK, null)).toMatchObject({
      total: 0,
      loggedDays: 0,
      daysInRange: 7,
      averagePerLoggedDay: null,
      overGoalDays: 0,
      averageVsGoal: null,
    });
  });

  it("ignores totals for Days outside the Period", () => {
    const result = summarise(
      [
        day("2026-10-25", 5000),
        day("2026-10-26", 2000),
        day("2026-11-02", 5000),
      ],
      WEEK,
      null,
    );

    expect(result.total).toBe(2000);
    expect(result.loggedDays).toBe(1);
  });

  it("has nothing about a Goal when there is no Goal", () => {
    const result = summarise([day("2026-10-26", 3000)], WEEK, null);

    expect(result.averageVsGoal).toBeNull();
    expect(result.overGoalDays).toBe(0);
  });

  it("compares the average with the Goal: negative is under, positive is over", () => {
    const under = summarise(
      [day("2026-10-26", 2000), day("2026-10-27", 2040)],
      WEEK,
      2200,
    );
    expect(under.averageVsGoal).toBe(-180);

    const over = summarise([day("2026-10-26", 2500)], WEEK, 2200);
    expect(over.averageVsGoal).toBe(300);
  });

  it("counts the logged Days that went over the Goal", () => {
    const result = summarise(
      [
        day("2026-10-26", 2500),
        day("2026-10-27", 2200),
        day("2026-10-28", 2201),
        day("2026-10-29", 1800),
      ],
      WEEK,
      2200,
    );

    // Exactly on the Goal is not over; one kcal past it is.
    expect(result.overGoalDays).toBe(2);
    expect(result.loggedDays).toBe(4);
  });

  it("only counts Days that were logged towards the Goal", () => {
    const result = summarise([day("2026-10-26", 100)], WEEK, 500);

    expect(result.overGoalDays).toBe(0);
  });

  it("works for a Period of one Day", () => {
    const result = summarise(
      [day("2026-11-02", 1900)],
      range(["2026-11-02"]),
      2200,
    );

    expect(result).toMatchObject({
      total: 1900,
      loggedDays: 1,
      daysInRange: 1,
      averagePerLoggedDay: 1900,
      averageVsGoal: -300,
    });
  });
});
