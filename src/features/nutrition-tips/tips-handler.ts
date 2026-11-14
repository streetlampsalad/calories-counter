import { dayOfWeek, shiftDay } from "@/features/entries/days";
import type { WeekStart } from "@/features/settings/domain";
import { AiUnavailable } from "@/lib/ai";
import { GEMINI_LIGHT_MODEL, geminiTransport } from "@/lib/gemini";
import { GeminiTipsWriter } from "./gemini-tips-writer";
import {
  MIN_LOGGED_DAYS,
  summariseWeek,
  type WeekRow,
  type WeekSummary,
} from "./week";

// Three tries a day per User keeps a few friends well inside the Gemini free tier.
export const TIPS_DAILY_LIMIT = 3;
const MAX_TIPS = 3;
const MAX_NUTRIENT = 40;
const MAX_TIP = 200;
// A week start may be at most this many Days before today.
const MAX_WEEK_AGE = 14;

export type NutritionTip = { nutrient: string; tip: string };

// Writes Nutrition tips for a week of eating.
export interface TipsWriter {
  write(week: WeekSummary): Promise<NutritionTip[]>;
}

// Stands in for Gemini in tests and in local development without a key.
export class FakeTipsWriter implements TipsWriter {
  async write(_week?: WeekSummary): Promise<NutritionTip[]> {
    return [
      {
        nutrient: "Omega-3",
        tip: "Not much oily fish last week. Salmon or sardines once or twice next week would help.",
      },
      {
        nutrient: "Fibre",
        tip: "Add some wholegrain bread or a handful of nuts to your day (test data).",
      },
    ];
  }
}

class UnavailableWriter implements TipsWriter {
  async write(): Promise<NutritionTip[]> {
    throw new AiUnavailable("no tips writer is configured");
  }
}

// Which writer this deployment uses. Production without a key is unavailable, never fake.
export function getTipsWriter(
  env: Record<string, string | undefined> = process.env,
): TipsWriter {
  if (env.NUTRITION_TIPS === "fake") return new FakeTipsWriter();
  if (env.GEMINI_API_KEY) {
    return new GeminiTipsWriter(
      geminiTransport(env.GEMINI_API_KEY, { model: GEMINI_LIGHT_MODEL }),
    );
  }
  if (env.NODE_ENV !== "production") return new FakeTipsWriter();
  return new UnavailableWriter();
}

type Deps = {
  userId: () => Promise<string | null>;
  /** The day the User's week starts on, from their settings. */
  weekStartsOn: () => Promise<WeekStart>;
  /** The User's own Entries (RLS applies) from one Day to another, inclusive. */
  entries: (from: string, to: string) => Promise<WeekRow[]>;
  /** Counts a use of this kind against the User's day and says whether they may still make one. */
  allowUse: (kind: string) => Promise<boolean>;
  /** Keeps the set for the week, replacing any kept before (the User's own client, so RLS applies). */
  keepTips: (weekStart: string, tips: NutritionTip[]) => Promise<void>;
  writer: TipsWriter;
  now?: () => Date;
};

const reply = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// A Day is a calendar day in Sydney (the same as the daily allowance counts).
function sydneyToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const isRealDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && shiftDay(value, 0) === value;

// Whatever the model said, only short, usable tips get through.
function tidy(raw: unknown): NutritionTip[] {
  if (!Array.isArray(raw)) return [];
  const tips: NutritionTip[] = [];
  for (const item of raw) {
    const { nutrient, tip } = (item ?? {}) as Record<string, unknown>;
    if (typeof nutrient !== "string" || typeof tip !== "string") continue;
    const cleanNutrient = nutrient.trim();
    const cleanTip = tip.trim();
    if (!cleanNutrient || !cleanTip) continue;
    tips.push({
      nutrient: cleanNutrient.slice(0, MAX_NUTRIENT),
      tip: cleanTip.slice(0, MAX_TIP),
    });
  }
  return tips.slice(0, MAX_TIPS);
}

// Nutrition tips for last week (spec 219): checks the week and the daily allowance, then
// asks the writer. Nothing about the User goes to it, only what they ate.
export async function handleTips(
  request: Request,
  { userId, weekStartsOn, entries, allowUse, keepTips, writer, now }: Deps,
): Promise<Response> {
  if ((await userId()) === null) return reply(401, { code: "unauthorized" });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply(400, { code: "bad_request" });
  }
  const weekStart = (body as { weekStart?: unknown } | null)?.weekStart;
  if (typeof weekStart !== "string") return reply(400, { code: "bad_request" });

  try {
    const today = sydneyToday(now?.() ?? new Date());
    const startsOn = await weekStartsOn();
    if (
      !isRealDay(weekStart) ||
      dayOfWeek(weekStart) !== startsOn ||
      shiftDay(weekStart, 6) > today ||
      weekStart < shiftDay(today, -MAX_WEEK_AGE)
    ) {
      return reply(400, { code: "bad_week" });
    }

    const rows = await entries(weekStart, shiftDay(weekStart, 6));
    const summary = summariseWeek(rows);
    if (summary.loggedDays < MIN_LOGGED_DAYS) {
      return reply(422, { code: "not_enough_days" });
    }

    // Counted before Gemini is asked, so a try that fails still counts.
    if (!(await allowUse("tips"))) return reply(429, { code: "limit_reached" });

    const tips = tidy(await writer.write(summary));
    if (tips.length === 0) {
      console.error("Tips were not usable");
      return reply(500, { code: "tips_failed" });
    }
    // A set that cannot be kept still reaches the User; they just ask again after a reload.
    try {
      await keepTips(weekStart, tips);
    } catch (error) {
      console.error(
        `Tips were not kept: ${error instanceof Error ? error.name : "unknown error"}`,
      );
    }
    return reply(200, { tips });
  } catch (error) {
    if (error instanceof AiUnavailable) {
      return reply(503, { code: "tips_unavailable" });
    }
    console.error(
      `Tips failed: ${error instanceof Error ? error.name : "unknown error"}`,
    );
    return reply(500, { code: "tips_failed" });
  }
}
