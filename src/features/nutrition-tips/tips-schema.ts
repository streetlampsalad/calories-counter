import { z } from "zod";

// One Nutrition tip, as the model answers and as a kept set stores it. Shared by the server and
// the browser, so it imports nothing else.
export const tipSchema = z.object({ nutrient: z.string(), tip: z.string() });

// A kept set: one to three tips. A row that does not parse counts as no tips.
export const keptTipsSchema = z.array(tipSchema).min(1).max(3);
