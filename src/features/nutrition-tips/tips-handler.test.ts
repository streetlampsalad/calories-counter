import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiUnavailable } from "@/lib/ai";
import {
  FakeTipsWriter,
  getTipsWriter,
  handleTips,
  type NutritionTip,
  TIPS_DAILY_LIMIT,
  type TipsWriter,
} from "./tips-handler";
import type { WeekRow } from "./week";

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = { create: vi.fn() };
  },
}));

// 2026-11-13 is a Friday in Sydney. Last week (weeks starting Monday) began on 2026-11-02.
const NOW = new Date("2026-11-13T02:00:00Z");
const WEEK = "2026-11-02";

const write = vi.fn<TipsWriter["write"]>();
const allowUse = vi.fn<(kind: string) => Promise<boolean>>();
const entries = vi.fn<(from: string, to: string) => Promise<WeekRow[]>>();
const keepTips =
  vi.fn<(weekStart: string, tips: NutritionTip[]) => Promise<void>>();

const row = (day: string): WeekRow => ({
  foodId: "f1",
  day,
  quantity: 1,
  name: "Toast",
  portion: "1 slice",
  calories: 90,
});
const threeDays = [row("2026-11-02"), row("2026-11-03"), row("2026-11-04")];

const post = (body: unknown, raw = false) =>
  new Request("http://localhost/api/nutrition-tips", {
    method: "POST",
    body: raw ? String(body) : JSON.stringify(body),
  });
const call = (
  request: Request,
  options: { userId?: string | null; weekStartsOn?: 0 | 1 } = {},
) =>
  handleTips(request, {
    userId: async () => (options.userId === undefined ? "u1" : options.userId),
    weekStartsOn: async () => options.weekStartsOn ?? 1,
    entries,
    allowUse,
    keepTips,
    writer: { write },
    now: () => NOW,
  });

beforeEach(() => {
  write
    .mockReset()
    .mockResolvedValue([{ nutrient: "Omega-3", tip: "Salmon." }]);
  allowUse.mockReset().mockResolvedValue(true);
  entries.mockReset().mockResolvedValue(threeDays);
  keepTips.mockReset().mockResolvedValue(undefined);
});

describe("handleTips checks", () => {
  it("answers 401 with no session (before anything else)", async () => {
    const response = await call(post({ weekStart: WEEK }), { userId: null });
    expect(response.status).toBe(401);
  });

  it("answers 400 bad_request when the body is not JSON or has no weekStart", async () => {
    expect((await call(post("nope", true))).status).toBe(400);
    const response = await call(post({}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "bad_request" });
  });

  it.each([
    ["not a date", "last week"],
    ["not a real date", "2026-02-30"],
    ["not the day weeks start on", "2026-11-03"],
    ["ending after today", "2026-11-09"],
    ["more than 14 Days ago", "2026-10-26"],
  ])("answers 400 bad_week for a week start that is %s (US1.9)", async (_name, weekStart) => {
    const response = await call(post({ weekStart }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "bad_week" });
    expect(entries).not.toHaveBeenCalled();
    expect(allowUse).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("checks the week against the User's own week start day", async () => {
    // Sunday 1 Nov is last week's start for a Sunday-start User.
    expect(
      (await call(post({ weekStart: "2026-11-01" }), { weekStartsOn: 0 }))
        .status,
    ).toBe(200);
    expect(
      (await call(post({ weekStart: WEEK }), { weekStartsOn: 0 })).status,
    ).toBe(400);
  });

  it("uses today in Sydney, not UTC", async () => {
    // 2026-11-08 23:00 UTC is already Monday 9 Nov in Sydney, so 2026-11-02 week has ended.
    const response = await handleTips(post({ weekStart: WEEK }), {
      userId: async () => "u1",
      weekStartsOn: async () => 1,
      entries,
      allowUse,
      keepTips,
      writer: { write },
      now: () => new Date("2026-11-08T23:00:00Z"),
    });
    expect(response.status).toBe(200);
  });

  it("answers 422 not_enough_days before spending the allowance (US1.3)", async () => {
    entries.mockResolvedValue(threeDays.slice(0, 2));
    const response = await call(post({ weekStart: WEEK }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ code: "not_enough_days" });
    expect(allowUse).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("answers 429 at the daily limit without calling Gemini (US1.7)", async () => {
    allowUse.mockResolvedValue(false);
    const response = await call(post({ weekStart: WEEK }));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ code: "limit_reached" });
    expect(allowUse).toHaveBeenCalledWith("tips");
    expect(TIPS_DAILY_LIMIT).toBe(3);
    expect(write).not.toHaveBeenCalled();
  });
});

describe("handleTips answers", () => {
  it("sends the writer the week summary and answers 200 with no-store (US1.4)", async () => {
    const response = await call(post({ weekStart: WEEK }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      tips: [{ nutrient: "Omega-3", tip: "Salmon." }],
    });
    expect(entries).toHaveBeenCalledWith("2026-11-02", "2026-11-08");
    expect(write).toHaveBeenCalledWith({
      loggedDays: 3,
      foods: [{ name: "Toast", portion: "1 slice", calories: 90, quantity: 3 }],
    });
  });

  it("answers 503 tips_unavailable when Gemini is unavailable (US1.8)", async () => {
    write.mockRejectedValue(new AiUnavailable("quota"));
    const response = await call(post({ weekStart: WEEK }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "tips_unavailable" });
    expect(allowUse).toHaveBeenCalled();
  });

  it("answers 500 tips_failed for any other failure", async () => {
    write.mockRejectedValue(new Error("boom"));
    const response = await call(post({ weekStart: WEEK }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "tips_failed" });
  });

  it("answers 500 tips_failed when the entries cannot be read", async () => {
    entries.mockRejectedValue(new Error("db"));
    expect((await call(post({ weekStart: WEEK }))).status).toBe(500);
  });
});

describe("handleTips keeps the set (US2.2, FR-007)", () => {
  it("saves the tidied set for the week after a successful write", async () => {
    write.mockResolvedValue([{ nutrient: " Iron ", tip: "Add lentils." }]);
    const response = await call(post({ weekStart: WEEK }));
    expect(response.status).toBe(200);
    expect(keepTips).toHaveBeenCalledTimes(1);
    expect(keepTips).toHaveBeenCalledWith(WEEK, [
      { nutrient: "Iron", tip: "Add lentils." },
    ]);
  });

  it("still answers 200 with the tips when the save fails, and logs it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    keepTips.mockRejectedValue(new Error("db"));
    const response = await call(post({ weekStart: WEEK }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      tips: [{ nutrient: "Omega-3", tip: "Salmon." }],
    });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it.each([
    ["401", { userId: null }, () => {}],
    ["422", {}, () => entries.mockResolvedValue([])],
    ["429", {}, () => allowUse.mockResolvedValue(false)],
    ["503", {}, () => write.mockRejectedValue(new AiUnavailable("quota"))],
    ["500", {}, () => write.mockRejectedValue(new Error("boom"))],
    [
      "500 with none usable",
      {},
      () => write.mockResolvedValue([{ nutrient: "", tip: "" }]),
    ],
  ])("saves nothing on a %s", async (_name, options, arrange) => {
    arrange();
    await call(post({ weekStart: WEEK }), options);
    expect(keepTips).not.toHaveBeenCalled();
  });

  it("saves nothing on a 400", async () => {
    await call(post({ weekStart: "2026-11-03" }));
    await call(post({}));
    expect(keepTips).not.toHaveBeenCalled();
  });
});

describe("handleTips tidy-up (US1.5)", () => {
  const tips = async () =>
    (await (await call(post({ weekStart: WEEK }))).json()) as {
      tips: { nutrient: string; tip: string }[];
    };

  it("keeps at most three tips", async () => {
    write.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        nutrient: `N${i}`,
        tip: `T${i}`,
      })),
    );
    expect((await tips()).tips.map((t) => t.nutrient)).toEqual([
      "N0",
      "N1",
      "N2",
    ]);
  });

  it("trims, and drops a tip with an empty nutrient or tip", async () => {
    write.mockResolvedValue([
      { nutrient: "  Iron ", tip: " Add lentils. " },
      { nutrient: "  ", tip: "Something" },
      { nutrient: "Fibre", tip: "   " },
    ]);
    expect((await tips()).tips).toEqual([
      { nutrient: "Iron", tip: "Add lentils." },
    ]);
  });

  it("cuts a nutrient to 40 and a tip to 200 characters", async () => {
    write.mockResolvedValue([
      { nutrient: "n".repeat(60), tip: "t".repeat(300) },
    ]);
    const [tip] = (await tips()).tips;
    expect(tip.nutrient).toHaveLength(40);
    expect(tip.tip).toHaveLength(200);
  });

  it("answers 500 tips_failed when none is left", async () => {
    write.mockResolvedValue([{ nutrient: "", tip: "" }]);
    const response = await call(post({ weekStart: WEEK }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "tips_failed" });
  });
});

describe("getTipsWriter", () => {
  it("uses the fake when NUTRITION_TIPS is fake, even with a key", () => {
    expect(
      getTipsWriter({ NUTRITION_TIPS: "fake", GEMINI_API_KEY: "k" }),
    ).toBeInstanceOf(FakeTipsWriter);
  });

  it("uses Gemini when there is a key", () => {
    const writer = getTipsWriter({
      GEMINI_API_KEY: "k",
      NODE_ENV: "production",
    });
    expect(writer).not.toBeInstanceOf(FakeTipsWriter);
  });

  it("uses the fake with no key outside production", () => {
    expect(getTipsWriter({ NODE_ENV: "development" })).toBeInstanceOf(
      FakeTipsWriter,
    );
  });

  it("is unavailable, never fake, in production with no key", async () => {
    const writer = getTipsWriter({ NODE_ENV: "production" });
    await expect(
      writer.write({ loggedDays: 3, foods: [] }),
    ).rejects.toBeInstanceOf(AiUnavailable);
  });
});

describe("FakeTipsWriter", () => {
  it("returns two fixed tips", async () => {
    const tips = await new FakeTipsWriter().write({ loggedDays: 3, foods: [] });
    expect(tips).toHaveLength(2);
  });
});
