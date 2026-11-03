import { describe, expect, it } from "vitest";
import { formatRange, PERIODS, parsePeriod, periodRange } from "./period";

const MON = 1;
const SUN = 0;

describe("periodRange: weeks", () => {
  // 2026-11-03 is a Tuesday.
  it("This week runs from the start of the week up to and including today", () => {
    expect(periodRange("this-week", "2026-11-03", MON)).toMatchObject({
      from: "2026-11-02",
      to: "2026-11-03",
    });
    expect(periodRange("this-week", "2026-11-03", MON).days).toEqual([
      "2026-11-02",
      "2026-11-03",
    ]);
  });

  it("starts the week on Sunday when asked", () => {
    expect(periodRange("this-week", "2026-11-03", SUN)).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-03",
    });
  });

  it("Last week is the whole previous week", () => {
    const monday = periodRange("last-week", "2026-11-03", MON);
    expect(monday).toMatchObject({ from: "2026-10-26", to: "2026-11-01" });
    expect(monday.days).toHaveLength(7);

    const sunday = periodRange("last-week", "2026-11-03", SUN);
    expect(sunday).toMatchObject({ from: "2026-10-25", to: "2026-10-31" });
    expect(sunday.days).toHaveLength(7);
  });

  it("on the first day of the week, This week is just today and Last week is complete", () => {
    expect(periodRange("this-week", "2026-11-02", MON).days).toEqual([
      "2026-11-02",
    ]);
    expect(periodRange("last-week", "2026-11-02", MON)).toMatchObject({
      from: "2026-10-26",
      to: "2026-11-01",
    });
  });

  it("on the last day of the week, This week is seven days", () => {
    // Sunday 2026-11-01 ends a Monday-start week, but begins a Sunday-start one.
    expect(periodRange("this-week", "2026-11-01", MON).days).toHaveLength(7);
    expect(periodRange("this-week", "2026-11-01", SUN).days).toEqual([
      "2026-11-01",
    ]);
  });

  it("crosses a year boundary", () => {
    // 2026-01-01 is a Thursday.
    expect(periodRange("this-week", "2026-01-01", MON)).toMatchObject({
      from: "2025-12-29",
      to: "2026-01-01",
    });
    expect(periodRange("last-week", "2026-01-01", MON)).toMatchObject({
      from: "2025-12-22",
      to: "2025-12-28",
    });
  });
});

describe("periodRange: months", () => {
  it("This month runs from the 1st up to and including today", () => {
    expect(periodRange("this-month", "2026-11-03", MON)).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-03",
    });
  });

  it("on the 1st, This month is just today", () => {
    expect(periodRange("this-month", "2026-11-01", MON).days).toEqual([
      "2026-11-01",
    ]);
  });

  it("Last month is the whole previous month", () => {
    const october = periodRange("last-month", "2026-11-03", MON);
    expect(october).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(october.days).toHaveLength(31);
  });

  it("Last month from January is December of the year before", () => {
    expect(periodRange("last-month", "2026-01-15", MON)).toMatchObject({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("Last month knows February has 29 days in a leap year, and 28 otherwise", () => {
    expect(periodRange("last-month", "2024-03-10", MON).days).toHaveLength(29);
    expect(periodRange("last-month", "2025-03-10", MON).days).toHaveLength(28);
  });
});

describe("periodRange: last 30 days", () => {
  it("is today and the 29 Days before it", () => {
    const range = periodRange("last-30-days", "2026-11-03", MON);

    expect(range).toMatchObject({ from: "2026-10-05", to: "2026-11-03" });
    expect(range.days).toHaveLength(30);
  });

  it("does not depend on the week start", () => {
    expect(periodRange("last-30-days", "2026-11-03", SUN)).toEqual(
      periodRange("last-30-days", "2026-11-03", MON),
    );
  });
});

describe("periodRange: every Period", () => {
  const todays = [
    "2026-11-03",
    "2026-11-01",
    "2026-11-02",
    "2026-02-28",
    "2024-02-29",
    "2026-01-01",
    "2026-12-31",
  ];

  it.each(
    PERIODS.map((p) => p.id),
  )("%s never includes a future Day", (period) => {
    for (const today of todays) {
      for (const week of [MON, SUN] as const) {
        const range = periodRange(period, today, week);
        expect(range.to <= today, `${period} on ${today}`).toBe(true);
        expect(range.days.every((day) => day <= today)).toBe(true);
      }
    }
  });

  it.each(
    PERIODS.map((p) => p.id),
  )("%s lists consecutive Days from `from` to `to`", (period) => {
    const range = periodRange(period, "2026-11-03", MON);

    expect(range.days[0]).toBe(range.from);
    expect(range.days.at(-1)).toBe(range.to);
    expect(new Set(range.days).size).toBe(range.days.length);
  });
});

describe("PERIODS and parsePeriod", () => {
  it("lists the five Periods in order, with their names", () => {
    expect(PERIODS.map((p) => p.label)).toEqual([
      "This week",
      "Last week",
      "This month",
      "Last month",
      "Last 30 days",
    ]);
  });

  it("reads a Period from the URL, falling back to This week", () => {
    expect(parsePeriod("last-month")).toBe("last-month");
    expect(parsePeriod("last-30-days")).toBe("last-30-days");
    expect(parsePeriod(undefined)).toBe("this-week");
    expect(parsePeriod("")).toBe("this-week");
    expect(parsePeriod("nonsense")).toBe("this-week");
    expect(parsePeriod(["last-week", "this-month"])).toBe("last-week");
  });
});

describe("formatRange", () => {
  it("shows a range within one year as day and month", () => {
    expect(
      formatRange({ from: "2026-10-26", to: "2026-11-01", days: [] }),
    ).toBe("26 Oct – 1 Nov");
  });

  it("shows a single day on its own", () => {
    expect(
      formatRange({ from: "2026-11-03", to: "2026-11-03", days: [] }),
    ).toBe("3 Nov");
  });

  it("adds the years when a range crosses the new year", () => {
    expect(
      formatRange({ from: "2025-12-29", to: "2026-01-01", days: [] }),
    ).toBe("29 Dec 2025 – 1 Jan 2026");
  });

  it("shows a range within one month compactly", () => {
    expect(
      formatRange({ from: "2026-11-01", to: "2026-11-03", days: [] }),
    ).toBe("1 – 3 Nov");
  });
});
