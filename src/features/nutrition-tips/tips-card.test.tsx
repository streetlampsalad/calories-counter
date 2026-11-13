import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useDailyTotals = vi.fn();
vi.mock("@/features/summary/queries", () => ({
  useDailyTotals: (range: unknown) => useDailyTotals(range),
}));

// The kept set is read with the browser client: a row per week, or none.
const kept = vi.fn<(weekStart: string) => Promise<unknown>>();
const toggle = { on: true };
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== "nutrition_tips") throw new Error(`unexpected ${table}`);
      return {
        select: () => ({
          eq: (_column: string, weekStart: string) => ({
            maybeSingle: async () => ({
              data: await kept(weekStart),
              error: null,
            }),
          }),
        }),
      };
    },
  }),
}));
vi.mock("@/features/toggles/queries", () => ({
  useToggle: (key: string) => key === "feature-218" && toggle.on,
}));

import { TipsCard } from "./tips-card";

const fetchMock = vi.fn();
const day = (d: string) => ({ day: d, calories: 100, entryCount: 1 });
const enough = [day("2026-11-02"), day("2026-11-03"), day("2026-11-04")];

const refetch = vi.fn();

async function setup(totals: unknown = enough, today = "2026-11-13") {
  useDailyTotals.mockReturnValue(
    totals === "pending"
      ? { data: undefined, isPending: true, isError: false, refetch }
      : totals === "error"
        ? { data: undefined, isPending: false, isError: true, refetch }
        : { data: totals, isPending: false, isError: false, refetch },
  );
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  // 2026-11-13 is a Friday; last week (Monday start) is 2 - 8 Nov.
  render(
    <QueryClientProvider client={queryClient}>
      <TipsCard today={today} weekStartsOn={1} />
    </QueryClientProvider>,
  );
  // Wait for the kept set to be read (or skipped, with the Toggle off) before looking at the card.
  if (toggle.on) await waitFor(() => expect(kept).toHaveBeenCalled());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const respond = (status: number, body: unknown) =>
  fetchMock.mockResolvedValue(Response.json(body, { status }));
const getTips = () => screen.getByRole("button", { name: "Get tips" });

beforeEach(() => {
  useDailyTotals.mockReset();
  kept.mockReset().mockResolvedValue(null);
  toggle.on = true;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("TipsCard", () => {
  it("shows last week's Days and a Get tips button at least 44 px high (US1.1)", async () => {
    await setup();

    expect(
      screen.getByRole("region", { name: "Nutrition tips" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 – 8 Nov")).toBeInTheDocument();
    expect(getTips().className).toMatch(/min-h-11/);
    expect(useDailyTotals).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-11-02", to: "2026-11-08" }),
    );
  });

  it("offers Try again when last week's Days could not be loaded", async () => {
    await setup("error");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load last week.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says to log more, with no button, when fewer than 3 Days are logged (US1.3)", async () => {
    await setup(enough.slice(0, 2));

    expect(
      screen.getByText("Log food on at least 3 days in a week to get tips."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows no button while the Days are loading", async () => {
    await setup("pending");

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("posts the week's first Day, shows it is working, then the tips under the disclaimer (US1.4)", async () => {
    let finish: (value: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    await setup();
    await userEvent.click(getTips());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/nutrition-tips",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ weekStart: "2026-11-02" }),
      }),
    );
    const working = screen.getByRole("button", { name: /Getting tips/ });
    expect(working).toBeDisabled();

    finish(
      Response.json({
        tips: [
          { nutrient: "Omega-3", tip: "Add salmon." },
          { nutrient: "Fibre", tip: "Add oats." },
        ],
      }),
    );

    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Omega-3: Add salmon.");
    expect(items[0].querySelector("strong")).toHaveTextContent("Omega-3");
    expect(
      screen.getByText(
        "AI guesses from your food names, not medical or dietary advice.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ask again" }),
    ).toBeInTheDocument();
  });

  it("says when the daily limit is reached, and offers no button (US1.7)", async () => {
    respond(429, { code: "limit_reached" });
    await setup();
    await userEvent.click(getTips());

    expect(
      await screen.findByText(
        "You can get tips 3 times a day. Try again tomorrow.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says tips are unavailable and keeps the button when Gemini is down (US1.8)", async () => {
    respond(503, { code: "tips_unavailable" });
    await setup();
    await userEvent.click(getTips());

    expect(
      await screen.findByText(
        "Tips aren't available right now. Try again later.",
      ),
    ).toBeInTheDocument();
    expect(getTips()).toBeEnabled();
  });

  it("says it couldn't get tips, with Try again, for any other failure (US1.8)", async () => {
    respond(500, { code: "tips_failed" });
    await setup();
    await userEvent.click(getTips());

    expect(await screen.findByText("Couldn't get tips.")).toBeInTheDocument();
    respond(200, { tips: [{ nutrient: "Iron", tip: "Add lentils." }] });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Add lentils\./)).toBeInTheDocument();
  });

  it("says it couldn't get tips with no connection (US1.8)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await setup();
    await userEvent.click(getTips());

    expect(await screen.findByText("Couldn't get tips.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  describe("kept tips (US2)", () => {
    const keptRow = {
      tips: [{ nutrient: "Iron", tip: "Add lentils." }],
      created_at: "2026-11-10T01:00:00Z",
    };
    const askAgain = () => screen.getByRole("button", { name: "Ask again" });

    it("shows kept tips at once with Ask again, and does not call Gemini (US2.1)", async () => {
      kept.mockResolvedValue(keptRow);
      await setup();

      expect(await screen.findByText(/Add lentils\./)).toBeInTheDocument();
      expect(kept).toHaveBeenCalledWith("2026-11-02");
      expect(askAgain().className).toMatch(/min-h-11/);
      expect(
        screen.queryByRole("button", { name: "Get tips" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(
          "AI guesses from your food names, not medical or dietary advice.",
        ),
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("shows kept tips even when last week now has fewer than 3 Days", async () => {
      kept.mockResolvedValue(keptRow);
      await setup(enough.slice(0, 1));

      expect(await screen.findByText(/Add lentils\./)).toBeInTheDocument();
    });

    it("shows a kept row that does not parse as no tips", async () => {
      kept.mockResolvedValue({ tips: [], created_at: "2026-11-10T01:00:00Z" });
      await setup();

      expect(
        await screen.findByRole("button", { name: "Get tips" }),
      ).toBeEnabled();
      expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    });

    it("shows a kept row that is not a list as no tips", async () => {
      kept.mockResolvedValue({ tips: { nutrient: "x" }, created_at: "" });
      await setup();

      expect(
        await screen.findByRole("button", { name: "Get tips" }),
      ).toBeEnabled();
    });

    it("replaces the kept tips when Ask again works (US2.2)", async () => {
      kept.mockResolvedValue(keptRow);
      await setup();
      await screen.findByText(/Add lentils\./);
      respond(200, { tips: [{ nutrient: "Fibre", tip: "Add oats." }] });
      await userEvent.click(askAgain());

      expect(await screen.findByText(/Add oats\./)).toBeInTheDocument();
      expect(screen.queryByText(/Add lentils\./)).not.toBeInTheDocument();
      expect(askAgain()).toBeEnabled();
    });

    it("keeps the tips and shows the error under them when Ask again fails (US2.2)", async () => {
      kept.mockResolvedValue(keptRow);
      await setup();
      await screen.findByText(/Add lentils\./);
      respond(503, { code: "tips_unavailable" });
      await userEvent.click(askAgain());

      expect(
        await screen.findByText(
          "Tips aren't available right now. Try again later.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(/Add lentils\./)).toBeInTheDocument();
      expect(askAgain()).toBeEnabled();
    });

    it("keeps the tips and offers no Ask again at the daily limit (US2.2)", async () => {
      kept.mockResolvedValue(keptRow);
      await setup();
      await screen.findByText(/Add lentils\./);
      respond(429, { code: "limit_reached" });
      await userEvent.click(askAgain());

      expect(
        await screen.findByText(
          "You can get tips 3 times a day. Try again tomorrow.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(/Add lentils\./)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Ask again" }),
      ).not.toBeInTheDocument();
    });

    it("shows Get tips and none of the old tips in a new week (US2.3)", async () => {
      kept.mockImplementation(async (week) =>
        week === "2026-11-02" ? keptRow : null,
      );
      // The following Monday: last week is now 9 - 15 Nov.
      await setup(enough, "2026-11-16");

      expect(
        await screen.findByRole("button", { name: "Get tips" }),
      ).toBeEnabled();
      expect(kept).toHaveBeenCalledWith("2026-11-09");
      expect(screen.queryByText(/Add lentils\./)).not.toBeInTheDocument();
    });

    it("reads no kept tips while the Toggle is off (US2.6)", async () => {
      toggle.on = false;
      kept.mockResolvedValue(keptRow);
      await setup();

      await screen.findByRole("region", { name: "Nutrition tips" });
      expect(kept).not.toHaveBeenCalled();
      expect(screen.queryByText(/Add lentils\./)).not.toBeInTheDocument();
    });
  });
});
