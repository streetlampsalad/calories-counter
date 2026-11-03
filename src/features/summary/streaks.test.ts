import { describe, expect, it } from "vitest";
import { listDays } from "@/features/entries/days";
import type { PeriodRange } from "./period";
import {
  currentStreak,
  goalSplit,
  HISTORY_DAYS,
  historyRange,
  longestStreak,
  underGoalRun,
} from "./streaks";
import type { DayTotal } from "./summarise";

const total = (day: string, calories = 1500, entryCount = 1): DayTotal => ({
  day,
  calories,
  entryCount,
});
const logged = (...days: string[]) => days.map((day) => total(day));
const TODAY = "2026-11-03";

describe("currentStreak", () => {
  it("counts consecutive Logged Days ending today", () => {
    expect(
      currentStreak(logged("2026-11-01", "2026-11-02", "2026-11-03"), TODAY),
    ).toBe(3);
  });

  it("ends yesterday when today has nothing logged yet", () => {
    expect(
      currentStreak(logged("2026-10-31", "2026-11-01", "2026-11-02"), TODAY),
    ).toBe(3);
  });

  it("is zero when neither today nor yesterday is logged", () => {
    expect(currentStreak(logged("2026-10-30", "2026-10-31"), TODAY)).toBe(0);
  });

  it("stops at the first gap", () => {
    expect(
      currentStreak(logged("2026-10-30", "2026-11-02", "2026-11-03"), TODAY),
    ).toBe(2);
  });

  it("does not count a Day with no Entries", () => {
    expect(
      currentStreak(
        [total("2026-11-02", 0, 0), total("2026-11-03", 900)],
        TODAY,
      ),
    ).toBe(1);
  });

  it("is zero with nothing logged", () => {
    expect(currentStreak([], TODAY)).toBe(0);
  });

  it("ignores Days after today", () => {
    expect(currentStreak(logged("2026-11-04", "2026-11-05"), TODAY)).toBe(0);
  });

  it("crosses a month boundary", () => {
    expect(
      currentStreak(
        logged("2026-10-30", "2026-10-31", "2026-11-01"),
        "2026-11-01",
      ),
    ).toBe(3);
  });
});

describe("longestStreak", () => {
  it("is the longest run of consecutive Logged Days", () => {
    expect(
      longestStreak(
        logged(
          "2026-10-01",
          "2026-10-02",
          "2026-10-10",
          "2026-10-11",
          "2026-10-12",
          "2026-10-20",
        ),
      ),
    ).toBe(3);
  });

  it("is one for a single Logged Day, and zero for none", () => {
    expect(longestStreak(logged("2026-10-01"))).toBe(1);
    expect(longestStreak([])).toBe(0);
  });

  it("does not depend on the order it is given", () => {
    expect(
      longestStreak(logged("2026-10-03", "2026-10-01", "2026-10-02")),
    ).toBe(3);
  });

  it("ignores Days with no Entries", () => {
    expect(
      longestStreak([
        total("2026-10-01"),
        total("2026-10-02", 0, 0),
        total("2026-10-03"),
      ]),
    ).toBe(1);
  });

  it("is never shorter than the current run", () => {
    const days = logged("2026-11-01", "2026-11-02", "2026-11-03");

    expect(longestStreak(days)).toBeGreaterThanOrEqual(
      currentStreak(days, TODAY),
    );
  });
});

describe("goalSplit", () => {
  const range: PeriodRange = {
    from: "2026-11-01",
    to: "2026-11-05",
    days: listDays("2026-11-01", "2026-11-05"),
  };

  it("counts Logged Days over and under the Goal", () => {
    const split = goalSplit(
      [
        total("2026-11-01", 1900),
        total("2026-11-02", 2100),
        total("2026-11-03", 2500),
      ],
      range,
      2000,
    );

    expect(split).toEqual({ over: 2, under: 1, loggedDays: 3 });
  });

  it("counts a Day exactly on the Goal as under", () => {
    expect(goalSplit([total("2026-11-01", 2000)], range, 2000)).toEqual({
      over: 0,
      under: 1,
      loggedDays: 1,
    });
  });

  it("leaves out Days not logged and Days outside the range", () => {
    const split = goalSplit(
      [
        total("2026-11-01", 1000),
        total("2026-11-02", 0, 0),
        total("2026-10-31", 9999),
      ],
      range,
      2000,
    );

    expect(split).toEqual({ over: 0, under: 1, loggedDays: 1 });
  });
});

describe("underGoalRun", () => {
  it("counts consecutive Logged Days under the Goal, ending today", () => {
    const totals = [
      total("2026-11-01", 1800),
      total("2026-11-02", 1900),
      total("2026-11-03", 1700),
    ];

    expect(underGoalRun(totals, TODAY, 2000)).toBe(3);
  });

  it("stops at a Day over the Goal", () => {
    const totals = [
      total("2026-11-01", 2400),
      total("2026-11-02", 1900),
      total("2026-11-03", 1700),
    ];

    expect(underGoalRun(totals, TODAY, 2000)).toBe(2);
  });

  it("stops at a Day not logged", () => {
    const totals = [total("2026-11-01", 1000), total("2026-11-03", 1700)];

    expect(underGoalRun(totals, TODAY, 2000)).toBe(1);
  });

  it("starts from yesterday when today has nothing logged yet", () => {
    const totals = [total("2026-11-01", 1800), total("2026-11-02", 1900)];

    expect(underGoalRun(totals, TODAY, 2000)).toBe(2);
  });

  it("is zero when today is over the Goal", () => {
    expect(
      underGoalRun(
        [total("2026-11-02", 1000), total("2026-11-03", 2600)],
        TODAY,
        2000,
      ),
    ).toBe(0);
  });

  it("is zero with nothing logged", () => {
    expect(underGoalRun([], TODAY, 2000)).toBe(0);
  });
});

describe("historyRange", () => {
  it("looks back far enough for a long streak, ending today", () => {
    const range = historyRange(TODAY);

    expect(range.to).toBe(TODAY);
    expect(HISTORY_DAYS).toBe(400);
    expect(listDays(range.from, range.to)).toHaveLength(HISTORY_DAYS);
  });
});
