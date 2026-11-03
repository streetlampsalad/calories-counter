import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DailyChart } from "./daily-chart";
import type { PeriodRange } from "./period";

const WEEK: PeriodRange = {
  from: "2026-10-26",
  to: "2026-11-01",
  days: [
    "2026-10-26",
    "2026-10-27",
    "2026-10-28",
    "2026-10-29",
    "2026-10-30",
    "2026-10-31",
    "2026-11-01",
  ],
};
const totals = [
  { day: "2026-10-26", calories: 2000, entryCount: 2 },
  { day: "2026-10-27", calories: 1000, entryCount: 1 },
  { day: "2026-10-29", calories: 2600, entryCount: 3 },
];
const TODAY = "2026-11-03";

function draw(props: Partial<React.ComponentProps<typeof DailyChart>> = {}) {
  return render(
    <DailyChart
      totals={totals}
      range={WEEK}
      goal={null}
      today={TODAY}
      {...props}
    />,
  );
}
const days = () =>
  within(screen.getByRole("list", { name: "Daily calories" })).getAllByRole(
    "listitem",
  );

describe("DailyChart", () => {
  it("has a slot for every Day of the Period, each a link to that Day", () => {
    draw();

    expect(days()).toHaveLength(7);
    const first = within(days()[0]).getByRole("link");
    expect(first).toHaveAttribute("href", "/?day=2026-10-26");
  });

  it("links today to the plain home page", () => {
    draw({
      range: {
        from: "2026-11-02",
        to: "2026-11-03",
        days: ["2026-11-02", "2026-11-03"],
      },
      totals: [{ day: "2026-11-03", calories: 900, entryCount: 1 }],
    });

    expect(within(days()[1]).getByRole("link")).toHaveAttribute("href", "/");
  });

  it("names each Day and its total for assistive technology", () => {
    draw();

    expect(
      within(days()[0]).getByRole("link", { name: "Mon 26 Oct: 2,000 kcal" }),
    ).toBeInTheDocument();
    expect(
      within(days()[2]).getByRole("link", {
        name: "Wed 28 Oct: nothing logged",
      }),
    ).toBeInTheDocument();
  });

  it("draws bars in proportion, against a tidy top", () => {
    draw();

    const bars = screen.getAllByTestId("bar");
    expect(bars).toHaveLength(3);
    // The tallest total is 2,600, so the top of the scale is 3,000.
    expect(bars[0]).toHaveStyle({ height: `${(2000 / 3000) * 100}%` });
    expect(bars[1]).toHaveStyle({ height: `${(1000 / 3000) * 100}%` });
  });

  it("leaves a Day with nothing logged as an empty slot, not a zero bar", () => {
    draw();

    expect(within(days()[2]).queryByTestId("bar")).not.toBeInTheDocument();
    expect(within(days()[0]).getByTestId("bar")).toBeInTheDocument();
  });

  it("labels the axis with the weekday letters", () => {
    draw();

    expect(screen.getByTestId("axis")).toHaveTextContent("MTWTFSS");
  });
});

describe("DailyChart with a Goal", () => {
  it("draws the Goal line, labelled", () => {
    draw({ goal: 2200 });

    expect(screen.getByTestId("goal-line")).toBeInTheDocument();
    expect(screen.getByTestId("goal-line")).toHaveTextContent("Goal 2,200");
  });

  it("marks a Day past the Goal by more than colour, and says so", () => {
    draw({ goal: 2200 });

    const over = within(days()[3]).getByTestId("bar");
    expect(over).toHaveAttribute("data-over");
    expect(over.getAttribute("style")).toMatch(/repeating-linear-gradient/);
    expect(
      within(days()[3]).getByRole("link", {
        name: "Thu 29 Oct: 2,600 kcal, 400 over goal",
      }),
    ).toBeInTheDocument();
    expect(within(days()[0]).getByTestId("bar")).not.toHaveAttribute(
      "data-over",
    );
  });

  it("keys the three encodings, since the bars alone no longer explain themselves", () => {
    draw({ goal: 2200 });

    const key = screen.getByRole("list", { name: "Key" });
    expect(key).toHaveTextContent("Calories");
    expect(key).toHaveTextContent("Goal");
    expect(key).toHaveTextContent("Over goal");
  });

  it("has no Goal line or key without a Goal", () => {
    draw({ goal: null });

    expect(screen.queryByTestId("goal-line")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Key" })).not.toBeInTheDocument();
    for (const bar of screen.getAllByTestId("bar")) {
      expect(bar).not.toHaveAttribute("data-over");
    }
  });
});

describe("DailyChart details", () => {
  it("invites a tap until a Day is pointed at", () => {
    draw();

    expect(screen.getByTestId("detail")).toHaveTextContent(
      "Tap a day to open it",
    );
  });

  it("shows the Day pointed at or focused, as text", async () => {
    draw({ goal: 2200 });

    await userEvent.hover(within(days()[3]).getByRole("link"));
    expect(screen.getByTestId("detail")).toHaveTextContent(
      "Thu 29 Oct: 2,600 kcal, 400 over goal",
    );

    await userEvent.unhover(within(days()[3]).getByRole("link"));
    expect(screen.getByTestId("detail")).toHaveTextContent(
      "Tap a day to open it",
    );
  });

  it("shows the same for keyboard focus", async () => {
    draw();

    await userEvent.tab();

    expect(screen.getByTestId("detail")).toHaveTextContent(
      "Mon 26 Oct: 2,000 kcal",
    );
  });
});

describe("DailyChart as a table", () => {
  it("offers every Day's total as a plain table", () => {
    draw({ goal: 2200 });

    const table = screen.getByRole("table", { name: "Daily calories" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(8); // header + 7 Days
    expect(rows[1]).toHaveTextContent("Mon 26 Oct");
    expect(rows[1]).toHaveTextContent("2,000");
    expect(rows[1]).toHaveTextContent("200 under");
    expect(rows[4]).toHaveTextContent("2,600");
    expect(rows[4]).toHaveTextContent("400 over");
    expect(rows[3]).toHaveTextContent("Not logged");
  });

  it("leaves out the Goal column when there is no Goal", () => {
    draw({ goal: null });

    expect(
      screen.queryByRole("columnheader", { name: "Against goal" }),
    ).not.toBeInTheDocument();
  });
});
