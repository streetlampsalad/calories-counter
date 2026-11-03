import { describe, expect, it } from "vitest";
import { AI_PROMPT } from "./ai-prompt";

describe("AI_PROMPT", () => {
  it("is exactly the text in spec 005, so any change is deliberate", () => {
    expect(AI_PROMPT).toBe(
      [
        "You are converting a photo of my handwritten food notes into data for a calorie-tracking app used in Australia.",
        "",
        "For every food written in the photo, output one row with:",
        `- name: the food's name as written, with spelling corrected, in sentence case (e.g. "Vegemite toast").`,
        `- portion: the amount the energy value refers to, in Australian metric terms (e.g. "1 slice", "100 g", "250 ml", "1 cup", "1 piece"). If no amount is written, use "1 serve".`,
        "- calories: a whole number of kilocalories (kcal) for that portion. If the note gives kilojoules (kJ), divide by 4.184 and round to the nearest whole number.",
        "",
        "Rules:",
        "- Output CSV only, with no explanation and no code fences.",
        "- The first line must be exactly: name,portion,calories",
        "- Wrap any value that contains a comma in double quotes.",
        "- If you cannot read a food's energy value, still include the row and leave calories empty.",
        "- Only include foods that are actually written in the photo.",
      ].join("\n"),
    );
  });
});
