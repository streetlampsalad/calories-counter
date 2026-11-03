import { describe, expect, it, vi } from "vitest";
import type { GeminiRequest } from "@/lib/gemini";
import { GeminiCalorieGuesser } from "./gemini-guesser";

const recorded = JSON.stringify({
  name: "Lamington",
  portion: "1 piece",
  calories: 190,
  basis: "A sponge square with chocolate icing and coconut",
});

describe("GeminiCalorieGuesser", () => {
  it("maps the model's answer to a guess", async () => {
    const guesser = new GeminiCalorieGuesser(async () => recorded);

    expect(await guesser.guess("lamington")).toEqual({
      name: "Lamington",
      portion: "1 piece",
      calories: 190,
      basis: "A sponge square with chocolate icing and coconut",
    });
  });

  it("asks about the food named, in Australian terms, for JSON in a fixed shape", async () => {
    const ask = vi.fn(async (_request: GeminiRequest) => recorded);

    await new GeminiCalorieGuesser(ask).guess("lamington");

    const request = ask.mock.calls[0][0];
    expect(request.input).toEqual([
      { type: "text", text: "Estimate: lamington" },
    ]);
    expect(request.system).toContain("Australia");
    expect(JSON.stringify(request.schema)).toContain("basis");
  });

  it("refuses an answer that is not in the shape asked for", async () => {
    for (const bad of [
      "nope",
      JSON.stringify({ name: "x" }),
      JSON.stringify({ name: "x", portion: "y", calories: 1.5, basis: "z" }),
      JSON.stringify({ name: "x", portion: "y", calories: "190", basis: "z" }),
    ]) {
      await expect(
        new GeminiCalorieGuesser(async () => bad).guess("x"),
      ).rejects.toThrow();
    }
  });
});
