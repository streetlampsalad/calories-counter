import {
  MAX_CALORIES,
  MAX_NAME,
  MAX_PORTION,
} from "@/features/foods/validation";
import { AiUnavailable } from "@/lib/ai";
import { GEMINI_LIGHT_MODEL, geminiTransport } from "@/lib/gemini";
import { GeminiCalorieGuesser } from "./gemini-guesser";
import { MIN_QUERY } from "./limits";

// Same free-tier allowance as photo reading, counted separately.
export const GUESS_DAILY_LIMIT = 30;
const MAX_QUERY = 100;
const MAX_BASIS = 200;

export type Guess = {
  name: string;
  /** An Australian portion, like "1 slice" or "100 g". */
  portion: string;
  calories: number;
  /** One line on what the estimate rests on. */
  basis: string;
};

// Estimates a food's Calories when no database has it.
export interface CalorieGuesser {
  guess(query: string): Promise<Guess>;
}

// Stands in for the real guesser in tests and in local development without a key.
export class FakeCalorieGuesser implements CalorieGuesser {
  async guess(query: string): Promise<Guess> {
    const name = query.charAt(0).toUpperCase() + query.slice(1);
    return {
      name,
      portion: "1 piece",
      calories: 190,
      basis: `A typical serving of ${query}, estimated (test data)`,
    };
  }
}

class UnavailableGuesser implements CalorieGuesser {
  async guess(): Promise<Guess> {
    throw new AiUnavailable("no guesser is configured");
  }
}

// Which guesser this deployment uses. Production without one is unavailable, never fake.
export function getCalorieGuesser(
  env: Record<string, string | undefined> = process.env,
): CalorieGuesser {
  if (env.CALORIE_GUESSER === "fake") return new FakeCalorieGuesser();
  if (env.GEMINI_API_KEY) {
    return new GeminiCalorieGuesser(
      geminiTransport(env.GEMINI_API_KEY, { model: GEMINI_LIGHT_MODEL }),
    );
  }
  if (env.NODE_ENV !== "production") return new FakeCalorieGuesser();
  return new UnavailableGuesser();
}

type Deps = {
  userId: () => Promise<string | null>;
  guesser: CalorieGuesser;
  /** Counts a use of this kind against the User's day and says whether they may still make one. */
  allowUse: (kind: string) => Promise<boolean>;
};

const reply = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Whatever the model said, only a usable food gets through.
function tidy(raw: unknown): Guess | null {
  if (!raw || typeof raw !== "object") return null;
  const { name, portion, calories, basis } = raw as Record<string, unknown>;
  if (typeof name !== "string" || typeof portion !== "string") return null;
  if (typeof basis !== "string" || typeof calories !== "number") return null;
  const cleanName = name.trim();
  const cleanPortion = portion.trim();
  if (!cleanName || cleanName.length > MAX_NAME) return null;
  if (!cleanPortion || cleanPortion.length > MAX_PORTION) return null;
  if (!Number.isInteger(calories) || calories < 0 || calories > MAX_CALORIES) {
    return null;
  }
  return {
    name: cleanName,
    portion: cleanPortion,
    calories,
    basis: basis.trim().slice(0, MAX_BASIS),
  };
}

// "Best guess" for a food nothing else knows: one estimated Suggestion, counted against the
// User's daily limit and never stored.
export async function handleGuess(
  request: Request,
  { userId, guesser, allowUse }: Deps,
): Promise<Response> {
  if ((await userId()) === null) return reply(401, { code: "unauthorized" });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply(400, { code: "bad_request" });
  }
  const raw = (body as { query?: unknown } | null)?.query;
  const query = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (query.length < MIN_QUERY || query.length > MAX_QUERY) {
    return reply(400, { code: "bad_query" });
  }

  try {
    if (!(await allowUse("guess")))
      return reply(429, { code: "limit_reached" });
  } catch {
    console.error("Guess usage check failed");
    return reply(500, { code: "guess_failed" });
  }

  try {
    const guess = tidy(await guesser.guess(query));
    if (!guess) {
      console.error("Guess was not a usable food");
      return reply(500, { code: "guess_failed" });
    }
    return reply(200, { guess });
  } catch (error) {
    if (error instanceof AiUnavailable) {
      return reply(503, { code: "guess_unavailable" });
    }
    console.error(
      `Guess failed: ${error instanceof Error ? error.name : "unknown error"}`,
    );
    return reply(500, { code: "guess_failed" });
  }
}
