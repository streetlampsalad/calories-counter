import { describe, expect, it, vi } from "vitest";
import { GeminiTipsWriter, TIPS_SYSTEM_PROMPT } from "./gemini-tips-writer";

const week = {
  loggedDays: 4,
  foods: [
    { name: "Toast", portion: "1 slice", calories: 90, quantity: 6 },
    { name: "Banana", portion: "1 medium", calories: 105, quantity: 2.5 },
  ],
};

describe("TIPS_SYSTEM_PROMPT (US1.6)", () => {
  it("asks only for foods to add, never less, skipping, calories, weight, supplements or conditions", () => {
    expect(TIPS_SYSTEM_PROMPT).toMatch(/add/i);
    for (const banned of [
      /eat less/i,
      /skip/i,
      /calorie/i,
      /weight/i,
      /supplement/i,
      /medical condition/i,
    ]) {
      expect(TIPS_SYSTEM_PROMPT).toMatch(banned);
    }
    expect(TIPS_SYSTEM_PROMPT).toMatch(/never/i);
  });

  it("asks for Australian English and foods sold in Australia", () => {
    expect(TIPS_SYSTEM_PROMPT).toMatch(/Australian English/);
    expect(TIPS_SYSTEM_PROMPT).toMatch(/sold in Australia/);
  });

  it("says the nutrition is a best guess from Food names and never to refuse", () => {
    expect(TIPS_SYSTEM_PROMPT).toMatch(/best guess/i);
    expect(TIPS_SYSTEM_PROMPT).toMatch(/Food names/i);
    expect(TIPS_SYSTEM_PROMPT).toMatch(/never refuse/i);
  });
});

describe("GeminiTipsWriter (US1.4)", () => {
  it("sends the system prompt and only names, Portions, Calories, Quantities and the Logged Days", async () => {
    const ask = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify({ tips: [{ nutrient: "Fibre", tip: "Add oats." }] }),
      );
    const tips = await new GeminiTipsWriter(ask).write(week);

    expect(tips).toEqual([{ nutrient: "Fibre", tip: "Add oats." }]);
    const request = ask.mock.calls[0][0];
    expect(request.system).toBe(TIPS_SYSTEM_PROMPT);
    const [input] = request.input;
    expect(input.type).toBe("text");
    expect(input.text).toContain("4");
    expect(input.text).toContain("Toast");
    expect(input.text).toContain("1 slice");
    expect(input.text).toContain("90");
    expect(input.text).toContain("6");
    expect(input.text).toContain("Banana");
    expect(input.text).toContain("2.5");
    expect(request.schema).toMatchObject({ type: "object" });
  });

  it("rejects an answer of the wrong shape", async () => {
    const ask = vi.fn().mockResolvedValue(JSON.stringify({ tips: "none" }));
    await expect(new GeminiTipsWriter(ask).write(week)).rejects.toThrow();
  });
});
