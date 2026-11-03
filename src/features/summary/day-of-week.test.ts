import { describe, expect, it } from "vitest";
import { listDays } from "@/features/entries/days";
import {
  busiestWeekday,
  dayOfWeekAverages,
  dayOfWeekHeadline,
  hasEnoughWeekdayData,
  MIN_LOGGED_DAYS_FOR_WEEKDAYS,
} from "./day-of-week";
import type { PeriodRange } from "./period";
import type { DayTotal } from "./summarise";

// Mon 5 Oct 2026 to Sun 1 Nov 2026: exactly four whole weeks.
const range = (from = "2026-10-05", to = "2026-11-01"): PeriodRange => ({
  from,
  to,
  days: listDays(from, to),
});
const total = (day: string, calories: number, entryCount = 1): DayTotal => ({
  day,
  calories,
  entryCount,
});
// Every Saturday 2,600, every other day 1,800.
const weekendHeavy = range().days.map((day) =>
  total(day, new Date(`${day}T00:00:00Z`).getUTCDay() === 6 ? 2600 : 1800),
);

describe("dayOfWeekAverages", () => {
  it("gives seven weekdays starting on the User's week start (Monday)", () => {
    const names = dayOfWeekAverages(weekendHeavy, range(), 1).map(
      (d) => d.name,
    );

    expect(names).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
  });

  it("starts on Sunday when the week starts on Sunday", () => {
    const averages = dayOfWeekAverages(weekendHeavy, range(), 0);

    expect(averages.map((d) => d.short)).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
  });

  it("averages each weekday over the Days of that weekday that were logged", () => {
    const averages = dayOfWeekAverages(weekendHeavy, range(), 1);
    const byName = Object.fromEntries(averages.map((d) => [d.name, d]));

    expect(byName.Saturday).toMatchObject({ average: 2600, loggedDays: 4 });
    expect(byName.Monday).toMatchObject({ average: 1800, loggedDays: 4 });
  });

  it("leaves a Day not logged out, rather than counting it as zero", () => {
    // Two Mondays: 2,000 logged, the other not logged at all.
    const averages = dayOfWeekAverages(
      [total("2026-10-05", 2000)],
      range("2026-10-05", "2026-10-12"),
      1,
    );

    expect(averages[0]).toMatchObject({
      name: "Monday",
      average: 2000,
      loggedDays: 1,
    });
  });

  it("has no average for a weekday that was never logged", () => {
    const averages = dayOfWeekAverages([total("2026-10-05", 2000)], range(), 1);

    expect(averages.find((d) => d.name === "Tuesday")).toMatchObject({
      average: null,
      loggedDays: 0,
    });
  });

  it("ignores Days outside the range and Days with no Entries", () => {
    const averages = dayOfWeekAverages(
      [
        total("2026-09-28", 9000), // a Monday before the range
        total("2026-10-12", 0, 0), // a Monday with no Entries
        total("2026-10-05", 2000),
      ],
      range(),
      1,
    );

    expect(averages[0]).toMatchObject({ average: 2000, loggedDays: 1 });
  });

  it("rounds the average to a whole kcal", () => {
    const averages = dayOfWeekAverages(
      [total("2026-10-05", 2000), total("2026-10-12", 2001)],
      range(),
      1,
    );

    expect(averages[0].average).toBe(2001); // 2000.5 rounds half up
  });
});

describe("busiestWeekday", () => {
  it("is the weekday with the highest average", () => {
    const busiest = busiestWeekday(dayOfWeekAverages(weekendHeavy, range(), 1));

    expect(busiest?.name).toBe("Saturday");
  });

  it("goes to the earlier weekday on a tie", () => {
    const flat = range().days.map((day) => total(day, 2000));

    expect(busiestWeekday(dayOfWeekAverages(flat, range(), 1))?.name).toBe(
      "Monday",
    );
    expect(busiestWeekday(dayOfWeekAverages(flat, range(), 0))?.name).toBe(
      "Sunday",
    );
  });

  it("is null when nothing was logged", () => {
    expect(busiestWeekday(dayOfWeekAverages([], range(), 1))).toBeNull();
  });
});

describe("dayOfWeekHeadline", () => {
  it("names the highest weekday and its average", () => {
    const averages = dayOfWeekAverages(weekendHeavy, range(), 1);

    expect(dayOfWeekHeadline(averages)).toBe("Saturdays average 2,600 kcal");
  });

  it("is null when nothing was logged", () => {
    expect(dayOfWeekHeadline(dayOfWeekAverages([], range(), 1))).toBeNull();
  });
});

describe("hasEnoughWeekdayData", () => {
  it("needs a fortnight of Logged Days in the range", () => {
    expect(MIN_LOGGED_DAYS_FOR_WEEKDAYS).toBe(14);
    const days = range().days;

    expect(
      hasEnoughWeekdayData(
        days.slice(0, 13).map((d) => total(d, 1500)),
        range(),
      ),
    ).toBe(false);
    expect(
      hasEnoughWeekdayData(
        days.slice(0, 14).map((d) => total(d, 1500)),
        range(),
      ),
    ).toBe(true);
  });

  it("does not count Days with no Entries or outside the range", () => {
    const inRange = range()
      .days.slice(0, 13)
      .map((d) => total(d, 1500));

    expect(
      hasEnoughWeekdayData(
        [...inRange, total("2026-10-02", 1500), total("2026-10-30", 0, 0)],
        range(),
      ),
    ).toBe(false);
  });
});
