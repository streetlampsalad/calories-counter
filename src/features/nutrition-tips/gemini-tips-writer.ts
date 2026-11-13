import { z } from "zod";
import { type GeminiTransport, jsonSchema, parseModelJson } from "@/lib/gemini";
import type { NutritionTip, TipsWriter } from "./tips-handler";
import { tipSchema } from "./tips-schema";
import type { WeekSummary } from "./week";

export const TIPS_SYSTEM_PROMPT = `You write short Nutrition tips for a calorie-tracking app used in Australia. You are given the foods a person logged last week: each food's name, portion, calories per portion and how many portions they had in total, and on how many days they logged food.

Work out, as a best guess from the Food names, one to three nutrients the person may be short of (for example omega-3, fibre, iron, calcium, vitamin C). For each, write:
- nutrient: the nutrient's name, in a few words.
- tip: one or two short sentences suggesting one or two everyday foods to add next week, for example "Not much oily fish last week. Salmon or sardines once or twice next week would help."

Rules:
- Only suggest adding foods. Never tell the person to eat less of anything, skip meals, or cut anything out.
- Never mention a calorie number, weight, weight loss, supplements or a medical condition.
- Write in Australian English, and suggest foods sold in Australia.
- The nutrition is a best guess from the Food names, so never refuse. If the names are odd or in another language, still give your best guess.`;

const answer = z.object({
  tips: z.array(tipSchema),
});

// The one line of text Gemini is sent: the Logged Days and each Food, with nothing about the User.
export function describeWeek({ loggedDays, foods }: WeekSummary): string {
  const lines = foods.map(
    (food) =>
      `- ${food.name} (${food.portion}, ${food.calories} kcal per portion): ${food.quantity} portions`,
  );
  return `Food logged on ${loggedDays} days last week:\n${lines.join("\n")}`;
}

// Writes tips with Gemini. The route tidies the result again before it goes anywhere.
export class GeminiTipsWriter implements TipsWriter {
  constructor(private readonly ask: GeminiTransport) {}

  async write(week: WeekSummary): Promise<NutritionTip[]> {
    const text = await this.ask({
      system: TIPS_SYSTEM_PROMPT,
      input: [{ type: "text", text: describeWeek(week) }],
      schema: jsonSchema(answer),
    });
    return parseModelJson(text, answer).tips;
  }
}
