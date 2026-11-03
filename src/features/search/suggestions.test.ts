import { describe, expect, it } from "vitest";
import { describePer100, referenceSuggestion } from "./suggestions";

describe("referenceSuggestion", () => {
  const row = {
    id: "r1",
    source: "AFCD",
    name: "Banana, cavendish, raw",
    calories_per_100: 93,
    unit: "g",
  };

  it("keeps the name and the energy per 100 g", () => {
    expect(referenceSuggestion(row)).toMatchObject({
      key: "reference:r1",
      name: "Banana, cavendish, raw",
      per100: { calories: 93, unit: "g" },
    });
  });

  it("knows a liquid is per 100 ml", () => {
    expect(referenceSuggestion({ ...row, unit: "ml" }).per100?.unit).toBe("ml");
  });

  it("credits the Australian Food Composition Database", () => {
    expect(referenceSuggestion(row).sourceLabel).toMatch(
      /Australian Food Composition Database/,
    );
  });

  it("is not an estimate and has no serving", () => {
    const suggestion = referenceSuggestion(row);

    expect(suggestion.estimate).toBeUndefined();
    expect(suggestion.serving).toBeUndefined();
  });
});

describe("describePer100", () => {
  it("reads '93 kcal per 100 g'", () => {
    expect(describePer100({ calories: 93, unit: "g" })).toBe(
      "93 kcal per 100 g",
    );
    expect(describePer100({ calories: 1250, unit: "ml" })).toBe(
      "1,250 kcal per 100 ml",
    );
  });
});
