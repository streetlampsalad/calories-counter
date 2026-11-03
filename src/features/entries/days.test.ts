import { describe, expect, it } from "vitest";
import { dayLabel, localDateString, parseDay, shiftDay } from "./days";

describe("localDateString", () => {
  it("uses the device's calendar date, whatever the time of day", () => {
    expect(localDateString(new Date(2026, 10, 3, 0, 1))).toBe("2026-11-03");
    expect(localDateString(new Date(2026, 10, 3, 12, 0))).toBe("2026-11-03");
    expect(localDateString(new Date(2026, 10, 3, 23, 59))).toBe("2026-11-03");
  });

  it("pads single-digit months and days", () => {
    expect(localDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  // A toISOString-based version fails in both of these zones, so this guards the real bug.
  it.each([
    [
      "Pacific/Auckland",
      "UTC+13: early morning is still the previous day in UTC",
      [2026, 10, 4, 0, 30],
      "2026-11-04",
    ],
    [
      "Pacific/Pago_Pago",
      "UTC-11: late night is already the next day in UTC",
      [2026, 10, 3, 23, 30],
      "2026-11-03",
    ],
    [
      "Australia/Sydney",
      "the app's home zone",
      [2026, 10, 3, 23, 50],
      "2026-11-03",
    ],
  ] as const)("keeps the local date in %s (%s)", (zone, _why, parts, expected) => {
    const original = process.env.TZ;
    process.env.TZ = zone;
    try {
      const [year, month, day, hour, minute] = parts;
      expect(localDateString(new Date(year, month, day, hour, minute))).toBe(
        expected,
      );
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe("parseDay", () => {
  const today = "2026-11-03";

  it("falls back to today when there is no usable value", () => {
    expect(parseDay(undefined, today)).toBe(today);
    expect(parseDay("", today)).toBe(today);
    expect(parseDay("abc", today)).toBe(today);
    expect(parseDay("2026-2-3", today)).toBe(today);
    expect(parseDay("20261101", today)).toBe(today);
  });

  it("rejects dates that do not exist", () => {
    expect(parseDay("2026-13-01", today)).toBe(today);
    expect(parseDay("2026-02-30", today)).toBe(today);
    expect(parseDay("2026-00-10", today)).toBe(today);
  });

  it("accepts today and past Days, including leap days", () => {
    expect(parseDay("2026-11-03", today)).toBe("2026-11-03");
    expect(parseDay("2026-10-31", today)).toBe("2026-10-31");
    expect(parseDay("2024-02-29", today)).toBe("2024-02-29");
    expect(parseDay("2001-01-01", today)).toBe("2001-01-01");
  });

  it("never allows a future Day", () => {
    expect(parseDay("2026-11-04", today)).toBe(today);
    expect(parseDay("2027-01-01", today)).toBe(today);
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseDay(["2026-10-01", "2026-10-02"], today)).toBe("2026-10-01");
  });
});

describe("shiftDay", () => {
  it("moves by whole days across month, year and leap boundaries", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2025-12-31", 1)).toBe("2026-01-01");
    expect(shiftDay("2026-11-03", 0)).toBe("2026-11-03");
    expect(shiftDay("2026-11-03", -30)).toBe("2026-10-04");
  });

  it("is not thrown by daylight saving changes", () => {
    // Sydney clocks go forward on 2026-10-04 and back on 2026-04-05.
    expect(shiftDay("2026-10-03", 1)).toBe("2026-10-04");
    expect(shiftDay("2026-10-04", 1)).toBe("2026-10-05");
    expect(shiftDay("2026-04-04", 1)).toBe("2026-04-05");
    expect(shiftDay("2026-04-05", 1)).toBe("2026-04-06");
  });
});

describe("dayLabel", () => {
  const today = "2026-11-03";

  it("calls today and yesterday by name", () => {
    expect(dayLabel("2026-11-03", today)).toBe("Today");
    expect(dayLabel("2026-11-02", today)).toBe("Yesterday");
  });

  it("names other Days by weekday, date and month", () => {
    expect(dayLabel("2026-10-31", today)).toBe("Sat 31 Oct");
    expect(dayLabel("2026-01-05", today)).toBe("Mon 5 Jan");
  });

  it("adds the year for a Day in another year", () => {
    expect(dayLabel("2025-12-31", today)).toBe("Wed 31 Dec 2025");
    expect(dayLabel("2024-02-29", today)).toBe("Thu 29 Feb 2024");
  });
});
