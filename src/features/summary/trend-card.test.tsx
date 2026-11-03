import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { listDays } from "@/features/entries/days";
import type { PeriodRange } from "./period";
import type { DayTotal } from "./summarise";
import { TrendCard } from "./trend-card";

const range = (from: string, to: string): PeriodRange => ({
  from,
  to,
  days: listDays(from, to),
});
const MONTH = range("2026-10-05", "2026-11-03"); // 30 Days
const TODAY = "2026-11-03";

// The first 14 Days at 2,000 and the rest at 1,700: the 7-day average falls from 2,000 to 1,700.
const falling: DayTotal[] = MONTH.days.map((day, i) => ({
  day,
  calories: i < 14 ? 2000 : 1700,
  entryCount: 1,
}));

function draw(props: Partial<React.ComponentProps<typeof TrendCard>> = {}) {
  return render(
    <TrendCard
      totals={falling}
      range={MONTH}
      goal={null}
      today={TODAY}
      {...props}
    />,
  );
}
const card = () => screen.getByRole("region", { name: "Trend" });

describe("TrendCard", () => {
  it("says in words where the 7-day average has gone", () => {
    draw();

    expect(card()).toHaveTextContent(
      "Your 7-day average is down 300 kcal since 11 Oct",
    );
  });

  it("draws the line, with the latest average labelled directly", () => {
    draw();

    expect(
      screen.getByTestId("trend-line").querySelectorAll("path"),
    ).toHaveLength(1);
    expect(screen.getByTestId("trend-last")).toHaveTextContent("1,700");
  });

  it("has no Goal line without a Goal", () => {
    draw({ goal: null });

    expect(screen.queryByTestId("trend-goal")).not.toBeInTheDocument();
  });

  it("draws the Goal line, labelled, with one", () => {
    draw({ goal: 2000 });

    expect(screen.getByTestId("trend-goal")).toHaveTextContent("Goal 2,000");
  });
});

describe("TrendCard with too little data", () => {
  const few = falling.slice(0, 5);

  it("explains what it needs rather than drawing a misleading line", () => {
    draw({ totals: few });

    expect(card()).toHaveTextContent("Not enough data yet");
    expect(card()).toHaveTextContent("5 of 7 days logged so far");
    expect(screen.queryByTestId("trend-line")).not.toBeInTheDocument();
  });

  it("copes with no data at all", () => {
    draw({ totals: [] });

    expect(card()).toHaveTextContent("0 of 7 days logged so far");
  });

  it("only counts Days inside the Period", () => {
    const outside: DayTotal[] = listDays("2026-08-01", "2026-08-20").map(
      (day) => ({
        day,
        calories: 2000,
        entryCount: 1,
      }),
    );
    draw({ totals: outside });

    expect(card()).toHaveTextContent("Not enough data yet");
  });
});

describe("TrendCard details", () => {
  it("starts by inviting a touch", () => {
    draw();

    expect(screen.getByTestId("trend-detail")).toHaveTextContent(
      "Touch or point at the line to see a day",
    );
  });

  it("shows the Day under the pointer, as text", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 300,
      top: 0,
      height: 100,
      right: 300,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    draw();

    // The far right edge is the last Day, today.
    fireEvent.pointerMove(screen.getByTestId("trend-line"), { clientX: 300 });

    expect(screen.getByTestId("trend-detail")).toHaveTextContent(
      "Today: 7-day average 1,700 kcal",
    );

    fireEvent.pointerLeave(screen.getByTestId("trend-line"));
    expect(screen.getByTestId("trend-detail")).toHaveTextContent(
      "Touch or point at the line",
    );
    vi.restoreAllMocks();
  });

  it("offers every average as a table", () => {
    draw();

    const table = screen.getByRole("table", { name: "7-day average by day" });
    const rows = within(table).getAllByRole("row");
    // 30 Days, but the first 6 have no full window yet.
    expect(rows).toHaveLength(1 + 24);
    expect(rows[1]).toHaveTextContent("Sun 11 Oct");
    expect(rows[1]).toHaveTextContent("2,000");
  });
});
