import { describe, expect, it } from "vitest";
import {
  caloriesToKilojoules,
  kilojoulesToCalories,
  MAX_KILOJOULES,
  parseKilojoules,
} from "./energy";

describe("kilojoulesToCalories", () => {
  it("converts using 4.184 kJ per kcal, rounded to a whole number", () => {
    expect(kilojoulesToCalories(1000)).toBe(239);
    expect(kilojoulesToCalories(4.184)).toBe(1);
    expect(kilojoulesToCalories(2092)).toBe(500);
    expect(kilojoulesToCalories(0)).toBe(0);
  });

  it("rounds halves up", () => {
    expect(kilojoulesToCalories(2.092)).toBe(1);
    expect(kilojoulesToCalories(2.09)).toBe(0);
  });

  it("matches real Australian labels", () => {
    // A 250 ml flat white at ~ 590 kJ, a slice of wholemeal bread at ~ 380 kJ.
    expect(kilojoulesToCalories(590)).toBe(141);
    expect(kilojoulesToCalories(380)).toBe(91);
  });
});

describe("caloriesToKilojoules", () => {
  it("is the inverse, rounded to a whole number", () => {
    expect(caloriesToKilojoules(239)).toBe(1000);
    expect(caloriesToKilojoules(0)).toBe(0);
    expect(caloriesToKilojoules(500)).toBe(2092);
  });
});

describe("parseKilojoules", () => {
  it("accepts whole numbers up to the largest that still fits 9,999 kcal", () => {
    expect(parseKilojoules("0")).toBe(0);
    expect(parseKilojoules("1000")).toBe(1000);
    expect(parseKilojoules(String(MAX_KILOJOULES))).toBe(MAX_KILOJOULES);
    expect(kilojoulesToCalories(MAX_KILOJOULES)).toBe(9999);
  });

  it("rejects the first value that would exceed 9,999 kcal", () => {
    expect(parseKilojoules(String(MAX_KILOJOULES + 1))).toBeNull();
    expect(kilojoulesToCalories(MAX_KILOJOULES + 1)).toBe(10000);
  });

  it.each([
    "",
    " ",
    "abc",
    "-5",
    "1.5",
    "1e3",
    "1 000",
  ])("rejects %j", (text) => {
    expect(parseKilojoules(text)).toBeNull();
  });

  it("ignores surrounding spaces", () => {
    expect(parseKilojoules(" 590 ")).toBe(590);
  });
});
