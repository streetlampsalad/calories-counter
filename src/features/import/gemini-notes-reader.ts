import { z } from "zod";
import { type GeminiTransport, jsonSchema, parseModelJson } from "@/lib/gemini";
import type { NotesReader } from "./notes-reader";
import { type ImportRow, MAX_ROWS } from "./parse";

// Written for JSON rather than CSV, from the same rules as the prompt people paste into an AI app.
export const NOTES_SYSTEM_PROMPT = `You are converting a photo of handwritten food notes into data for a calorie-tracking app used in Australia.

For every food written in the photo, return one item with:
- name: the food's name as written, with spelling corrected, in sentence case (e.g. "Vegemite toast").
- portion: the amount the energy value refers to, in Australian metric terms (e.g. "1 slice", "100 g", "250 ml", "1 cup", "1 piece"). If no amount is written, use "1 serve".
- calories: a whole number of kilocalories (kcal) for that portion, if the notes give kcal or Calories.
- kilojoules: a whole number of kilojoules (kJ) for that portion, if the notes give kJ. Do not convert; give what is written.

Rules:
- Only include foods that are actually written in the photo. If there are none, return an empty list.
- If you cannot read a food's energy value, still include the food and leave calories and kilojoules out.
- Never invent values.`;

const energy = z.number().int().nonnegative().optional().nullable();
const answer = z.object({
  foods: z.array(
    z.object({
      name: z.string(),
      portion: z.string(),
      calories: energy,
      kilojoules: energy,
    }),
  ),
});

const asText = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

// Reads handwritten notes with Gemini, as rows for Import Review (which checks every one).
export class GeminiNotesReader implements NotesReader {
  constructor(private readonly ask: GeminiTransport) {}

  async readNotes(image: Uint8Array, mimeType: string): Promise<ImportRow[]> {
    const text = await this.ask({
      system: NOTES_SYSTEM_PROMPT,
      input: [
        { type: "text", text: "Read the food notes in this photo." },
        {
          type: "image",
          data: Buffer.from(image).toString("base64"),
          mime_type: mimeType,
        },
      ],
      schema: jsonSchema(answer),
    });
    const { foods } = parseModelJson(text, answer);
    return foods.slice(0, MAX_ROWS).map((food) => ({
      name: food.name,
      portion: food.portion,
      calories: asText(food.calories),
      kilojoules: asText(food.kilojoules),
    }));
  }
}
