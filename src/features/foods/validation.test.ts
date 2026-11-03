import { describe, expect, it } from "vitest";
import { parseFoodInput } from "./validation";

const valid = { name: "Sourdough toast", portion: "1 slice", calories: "110" };

describe("parseFoodInput", () => {
  it("accepts a valid Food", () => {
    expect(parseFoodInput(valid)).toEqual({
      ok: true,
      value: { name: "Sourdough toast", portion: "1 slice", calories: 110 },
    });
  });

  it("trims the name and Portion and collapses inner spaces", () => {
    const result = parseFoodInput({
      name: "  Peanut   butter ",
      portion: " 1  tbsp ",
      calories: "95",
    });

    expect(result).toEqual({
      ok: true,
      value: { name: "Peanut butter", portion: "1 tbsp", calories: 95 },
    });
  });

  it.each([
    "0",
    "9999",
  ])("accepts %s calories at the edge of the range", (calories) => {
    expect(parseFoodInput({ ...valid, calories }).ok).toBe(true);
  });

  it.each(["", "   "])("requires a name (%j)", (name) => {
    const result = parseFoodInput({ ...valid, name });

    expect(result).toMatchObject({
      ok: false,
      errors: { name: "Enter a name" },
    });
  });

  it("limits the name to 80 characters", () => {
    expect(parseFoodInput({ ...valid, name: "x".repeat(80) }).ok).toBe(true);
    expect(parseFoodInput({ ...valid, name: "x".repeat(81) })).toMatchObject({
      ok: false,
      errors: { name: "Name must be 80 characters or fewer" },
    });
  });

  it("requires a Portion and limits it to 40 characters", () => {
    expect(parseFoodInput({ ...valid, portion: " " })).toMatchObject({
      ok: false,
      errors: { portion: "Enter a portion, like 1 slice or 100 g" },
    });
    expect(parseFoodInput({ ...valid, portion: "x".repeat(41) })).toMatchObject(
      {
        ok: false,
        errors: { portion: "Portion must be 40 characters or fewer" },
      },
    );
  });

  it.each([
    "",
    "abc",
    "-1",
    "10000",
    "1.5",
    "1e3",
    "12 3",
  ])("rejects %j as calories", (calories) => {
    expect(parseFoodInput({ ...valid, calories })).toMatchObject({
      ok: false,
      errors: { calories: "Calories must be a whole number from 0 to 9,999" },
    });
  });

  it("reports every problem at once", () => {
    const result = parseFoodInput({ name: "", portion: "", calories: "" });

    expect(result).toMatchObject({ ok: false });
    if (!result.ok)
      expect(Object.keys(result.errors).sort()).toEqual([
        "calories",
        "name",
        "portion",
      ]);
  });
});
