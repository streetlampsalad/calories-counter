import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiUnavailable } from "@/lib/ai";
import { GeminiCalorieGuesser } from "./gemini-guesser";
import {
  type CalorieGuesser,
  FakeCalorieGuesser,
  GUESS_DAILY_LIMIT,
  getCalorieGuesser,
  handleGuess,
} from "./guess-handler";

const guess = vi.fn<CalorieGuesser["guess"]>();
const guesser: CalorieGuesser = { guess };
const allowUse = vi.fn<(kind: string) => Promise<boolean>>();
const signedIn = () => Promise.resolve("user-1");
const signedOut = () => Promise.resolve(null);

const post = (body: unknown, raw = false) =>
  new Request("http://localhost/api/search/guess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? String(body) : JSON.stringify(body),
  });
const call = (
  request: Request,
  userId: () => Promise<string | null> = signedIn,
) => handleGuess(request, { userId, guesser, allowUse });

const lamington = {
  name: "Lamington",
  portion: "1 piece",
  calories: 190,
  basis: "Sponge cake with chocolate icing and coconut",
};

describe("handleGuess", () => {
  beforeEach(() => {
    guess.mockReset();
    guess.mockResolvedValue(lamington);
    allowUse.mockReset();
    allowUse.mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("turns away someone who is signed out, without asking or counting", async () => {
    const response = await call(post({ query: "lamington" }), signedOut);

    expect(response.status).toBe(401);
    expect(guess).not.toHaveBeenCalled();
    expect(allowUse).not.toHaveBeenCalled();
  });

  it("returns one guess: name, an Australian portion, calories and the basis (AC-7)", async () => {
    const response = await call(post({ query: "lamington" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ guess: lamington });
    expect(guess).toHaveBeenCalledWith("lamington");
  });

  it("needs a query of two to 100 characters", async () => {
    for (const query of ["", " ", "a", "x".repeat(101), 5, null, undefined]) {
      expect((await call(post({ query }))).status).toBe(400);
    }
    expect((await call(post("not json", true))).status).toBe(400);
    expect((await call(post([1, 2]))).status).toBe(400);
    expect(guess).not.toHaveBeenCalled();
    expect(allowUse).not.toHaveBeenCalled();
  });

  it("tidies the query before asking", async () => {
    await call(post({ query: "  big   mac  " }));

    expect(guess).toHaveBeenCalledWith("big mac");
  });

  it("counts against its own kind of the daily limit, 30 a day (AC-8)", async () => {
    expect(GUESS_DAILY_LIMIT).toBe(30);

    await call(post({ query: "lamington" }));

    expect(allowUse).toHaveBeenCalledTimes(1);
    expect(allowUse).toHaveBeenCalledWith("guess");
  });

  it("refuses with 429 once the day's guesses are used, without asking", async () => {
    allowUse.mockResolvedValue(false);

    const response = await call(post({ query: "lamington" }));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ code: "limit_reached" });
    expect(guess).not.toHaveBeenCalled();
  });

  it("answers 503 when the AI service is unavailable (AC-8)", async () => {
    guess.mockRejectedValue(new AiUnavailable("quota"));

    const response = await call(post({ query: "lamington" }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "guess_unavailable" });
  });

  it("answers 500 for any other failure, without crashing", async () => {
    guess.mockRejectedValue(new Error("model returned nonsense"));

    const response = await call(post({ query: "lamington" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "guess_failed" });
  });

  it("fails safe if the usage check fails", async () => {
    allowUse.mockRejectedValue(new Error("db down"));

    const response = await call(post({ query: "lamington" }));

    expect(response.status).toBe(500);
    expect(guess).not.toHaveBeenCalled();
  });

  it("refuses an answer that is not a usable food, rather than passing it on", async () => {
    for (const bad of [
      { ...lamington, calories: -1 },
      { ...lamington, calories: 20000 },
      { ...lamington, calories: 190.5 },
      { ...lamington, calories: "190" },
      { ...lamington, name: "" },
      { ...lamington, name: "x".repeat(81) },
      { ...lamington, portion: "" },
      { ...lamington, portion: "x".repeat(41) },
      { ...lamington, basis: undefined },
      null,
    ]) {
      guess.mockResolvedValueOnce(bad as never);
      const response = await call(post({ query: "lamington" }));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ code: "guess_failed" });
    }
  });

  it("trims the guess and cuts a long basis note", async () => {
    guess.mockResolvedValue({
      ...lamington,
      name: "  Lamington ",
      basis: "b".repeat(400),
    });

    const { guess: result } = await (
      await call(post({ query: "lamington" }))
    ).json();

    expect(result.name).toBe("Lamington");
    expect(result.basis.length).toBeLessThanOrEqual(200);
  });

  it("is never cached", async () => {
    const response = await call(post({ query: "lamington" }));

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("FakeCalorieGuesser and getCalorieGuesser", () => {
  it("uses Gemini when there is an API key, unless told to fake", () => {
    expect(
      getCalorieGuesser({ GEMINI_API_KEY: "k", NODE_ENV: "production" }),
    ).toBeInstanceOf(GeminiCalorieGuesser);
    expect(
      getCalorieGuesser({ GEMINI_API_KEY: "k", CALORIE_GUESSER: "fake" }),
    ).toBeInstanceOf(FakeCalorieGuesser);
  });

  it("makes a plausible guess from the query", async () => {
    const result = await new FakeCalorieGuesser().guess("lamington");

    expect(result.name).toMatch(/lamington/i);
    expect(result.calories).toBeGreaterThan(0);
    expect(result.portion).toBeTruthy();
  });

  it("is used when asked, and in development", () => {
    expect(
      getCalorieGuesser({ CALORIE_GUESSER: "fake", NODE_ENV: "production" }),
    ).toBeInstanceOf(FakeCalorieGuesser);
    expect(getCalorieGuesser({ NODE_ENV: "development" })).toBeInstanceOf(
      FakeCalorieGuesser,
    );
  });

  it("is never fake in production: with none configured it is unavailable", async () => {
    const guesser = getCalorieGuesser({ NODE_ENV: "production" });

    await expect(guesser.guess("lamington")).rejects.toBeInstanceOf(
      AiUnavailable,
    );
  });
});
