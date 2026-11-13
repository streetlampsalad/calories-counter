import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useDailyTotals = vi.fn();
vi.mock("@/features/summary/queries", () => ({
  useDailyTotals: (range: unknown) => useDailyTotals(range),
}));

import { TipsCard } from "./tips-card";

const fetchMock = vi.fn();
const day = (d: string) => ({ day: d, calories: 100, entryCount: 1 });
const enough = [day("2026-11-02"), day("2026-11-03"), day("2026-11-04")];

const refetch = vi.fn();

function setup(totals: unknown = enough) {
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
      <TipsCard today="2026-11-13" weekStartsOn={1} />
    </QueryClientProvider>,
  );
}

const respond = (status: number, body: unknown) =>
  fetchMock.mockResolvedValue(Response.json(body, { status }));
const getTips = () => screen.getByRole("button", { name: "Get tips" });

beforeEach(() => {
  useDailyTotals.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("TipsCard", () => {
  it("shows last week's Days and a Get tips button at least 44 px high (US1.1)", () => {
    setup();

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
    setup("error");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load last week.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says to log more, with no button, when fewer than 3 Days are logged (US1.3)", () => {
    setup(enough.slice(0, 2));

    expect(
      screen.getByText("Log food on at least 3 days in a week to get tips."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows no button while the Days are loading", () => {
    setup("pending");

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("posts the week's first Day, shows it is working, then the tips under the disclaimer (US1.4)", async () => {
    let finish: (value: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    setup();
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
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says when the daily limit is reached, and offers no button (US1.7)", async () => {
    respond(429, { code: "limit_reached" });
    setup();
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
    setup();
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
    setup();
    await userEvent.click(getTips());

    expect(await screen.findByText("Couldn't get tips.")).toBeInTheDocument();
    respond(200, { tips: [{ nutrient: "Iron", tip: "Add lentils." }] });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Add lentils\./)).toBeInTheDocument();
  });

  it("says it couldn't get tips with no connection (US1.8)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    setup();
    await userEvent.click(getTips());

    expect(await screen.findByText("Couldn't get tips.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
