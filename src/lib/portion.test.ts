import { describe, expect, it } from "vitest";
import { parseMetricPortion, scaleCalories } from "./portion";

describe("parseMetricPortion", () => {
  it.each([
    ["150 g", { amount: 150, unit: "g" }],
    ["150g", { amount: 150, unit: "g" }],
    ["  150  G ", { amount: 150, unit: "g" }],
    ["250 ml", { amount: 250, unit: "ml" }],
    ["250ML", { amount: 250, unit: "ml" }],
    ["100 grams", { amount: 100, unit: "g" }],
    ["1 gram", { amount: 1, unit: "g" }],
    ["300 millilitres", { amount: 300, unit: "ml" }],
    ["1.5 kg", { amount: 1500, unit: "g" }],
    ["0.5 l", { amount: 500, unit: "ml" }],
    ["2 litres", { amount: 2000, unit: "ml" }],
    ["37.5 g", { amount: 37.5, unit: "g" }],
    ["37,5 g", { amount: 37.5, unit: "g" }],
  ])("reads %s", (text, expected) => {
    expect(parseMetricPortion(text)).toEqual(expected);
  });

  it.each([
    "",
    "1 cup",
    "1 slice",
    "serve",
    "150",
    "g",
    "ml",
    "-5 g",
    "0 g",
    "abc g",
    "150 g toast",
    "1 serve (30 g)",
    "1 / 2 g",
  ])("does not read %j", (text) => {
    expect(parseMetricPortion(text)).toBeNull();
  });
});

describe("scaleCalories", () => {
  it("scales per-100 calories to the amount, rounding half up (AC-4)", () => {
    expect(scaleCalories(165, 150)).toBe(248); // 247.5
    expect(scaleCalories(93, 150)).toBe(140); // 139.5
    expect(scaleCalories(100, 100)).toBe(100);
    expect(scaleCalories(250, 30)).toBe(75);
  });

  it("is zero for a zero-calorie food or amount", () => {
    expect(scaleCalories(0, 150)).toBe(0);
    expect(scaleCalories(165, 0)).toBe(0);
  });

  it("rounds every half up, as people expect", () => {
    expect(scaleCalories(33, 150)).toBe(50); // 49.5
    expect(scaleCalories(1, 50)).toBe(1); // 0.5
    expect(scaleCalories(3, 50)).toBe(2); // 1.5
    expect(scaleCalories(7, 50)).toBe(4); // 3.5
  });
});
