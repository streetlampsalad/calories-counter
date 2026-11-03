import { z } from "zod";
import { type GeminiTransport, jsonSchema, parseModelJson } from "@/lib/gemini";
import type { CalorieGuesser, Guess } from "./guess-handler";

export const GUESS_SYSTEM_PROMPT = `You estimate the calories in a food for a calorie-tracking app used in Australia.

Return one estimate for the food the person names:
- name: the food's name, in sentence case.
- portion: one realistic portion in Australian terms (e.g. "1 slice", "100 g", "250 ml", "1 cup", "1 piece", "1 serve").
- calories: a whole number of kilocalories (kcal) for that portion.
- basis: one short sentence saying what the estimate rests on (what the food is and what a portion contains).

Use typical Australian products and serving sizes. This is an estimate, so choose a middle-of-the-road value and never refuse.`;

const answer = z.object({
  name: z.string(),
  portion: z.string(),
  calories: z.number().int().nonnegative(),
  basis: z.string(),
});

// Estimates a food's Calories with Gemini. The route checks the result again before it goes anywhere.
export class GeminiCalorieGuesser implements CalorieGuesser {
  constructor(private readonly ask: GeminiTransport) {}

  async guess(query: string): Promise<Guess> {
    const text = await this.ask({
      system: GUESS_SYSTEM_PROMPT,
      input: [{ type: "text", text: `Estimate: ${query}` }],
      schema: jsonSchema(answer),
    });
    return parseModelJson(text, answer);
  }
}
