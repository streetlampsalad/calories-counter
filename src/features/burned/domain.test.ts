import { describe, expect, it } from "vitest";
import { burnedRowText, deficit, formatDeficit, parseBurned } from "./domain";

describe("parseBurned", () => {
  it.each(["500", "2450", "10000", " 2300 "])("accepts %j", (text) => {
    expect(parseBurned(text)).toEqual({ ok: true, value: Number(text.trim()) });
  });

  it.each([
    "",
    "   ",
    "abc",
    "-2000",
    "2450.5",
    "2,450",
    "499",
    "10001",
    "0",
  ])("refuses %j with the range in the message", (text) => {
    expect(parseBurned(text)).toEqual({
      ok: false,
      error: "Enter between 500 and 10,000 kcal",
    });
  });
});

describe("deficit (AC-5)", () => {
  it("is Calories Burned minus the Daily Total", () => {
    expect(deficit(1840, 2450)).toBe(610);
  });

  it("is negative, a Surplus, when more was eaten than burned", () => {
    expect(deficit(2650, 2450)).toBe(-200);
  });

  it("is zero when they match", () => {
    expect(deficit(2450, 2450)).toBe(0);
  });
});

describe("formatDeficit", () => {
  it("names a Deficit", () => {
    expect(formatDeficit(610)).toBe("610 kcal deficit");
  });

  it("names a Surplus without a minus sign", () => {
    expect(formatDeficit(-200)).toBe("200 kcal surplus");
  });

  it("groups thousands the Australian way", () => {
    expect(formatDeficit(1234)).toBe("1,234 kcal deficit");
    expect(formatDeficit(-12345)).toBe("12,345 kcal surplus");
  });

  it("calls a tie a deficit of nothing", () => {
    expect(formatDeficit(0)).toBe("0 kcal deficit");
  });
});

describe("burnedRowText (AC-3)", () => {
  const base = {
    caloriesBurned: 2450,
    hasEntries: true,
    dailyTotal: 1840,
    isToday: false,
  };

  it("invites you to add a figure when there is none", () => {
    expect(burnedRowText({ ...base, caloriesBurned: null })).toEqual({
      heading: "Burned",
      detail: "Add",
    });
  });

  it("shows the figure and the Deficit", () => {
    expect(burnedRowText(base)).toEqual({
      heading: "Burned 2,450 kcal",
      detail: "610 kcal deficit",
    });
  });

  it("shows a Surplus when the Daily Total is higher", () => {
    expect(burnedRowText({ ...base, dailyTotal: 2650 })).toEqual({
      heading: "Burned 2,450 kcal",
      detail: "200 kcal surplus",
    });
  });

  it("asks for food, rather than claiming a Deficit, when nothing is logged", () => {
    expect(
      burnedRowText({ ...base, hasEntries: false, dailyTotal: 0 }),
    ).toEqual({
      heading: "Burned 2,450 kcal",
      detail: "Log food to see your deficit",
    });
  });

  it("counts a Day of zero-calorie Entries as logged", () => {
    expect(burnedRowText({ ...base, dailyTotal: 0 }).detail).toBe(
      "2,450 kcal deficit",
    );
  });

  it("says so far on today, whose burn is still rising", () => {
    expect(burnedRowText({ ...base, isToday: true })).toEqual({
      heading: "Burned so far 2,450 kcal",
      detail: "610 kcal deficit",
    });
    expect(
      burnedRowText({ ...base, isToday: true, caloriesBurned: null }),
    ).toEqual({ heading: "Burned so far", detail: "Add" });
  });
});
