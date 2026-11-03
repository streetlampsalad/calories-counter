import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { listDays } from "@/features/entries/days";
import { GoalCard, StreakCard } from "./consistency-cards";
import type { PeriodRange } from "./period";
import type { DayTotal } from "./summarise";

const TODAY = "2026-11-03";
const total = (day: string, calories = 1500): DayTotal => ({
  day,
  calories,
  entryCount: 1,
});
const range: PeriodRange = {
  from: "2026-10-28",
  to: TODAY,
  days: listDays("2026-10-28", TODAY),
};

describe("GoalCard", () => {
  const totals = [
    total("2026-10-28", 1800),
    total("2026-10-29", 2300),
    total("2026-10-30", 2500),
    total("2026-11-02", 1900),
    total("2026-11-03", 1700),
  ];
  const card = () => screen.getByRole("region", { name: "Goal" });

  it("says how many Logged Days were over and under the Goal", () => {
    render(
      <GoalCard
        totals={totals}
        history={totals}
        range={range}
        goal={2000}
        today={TODAY}
      />,
    );

    expect(card()).toHaveTextContent("3 days under goal");
    expect(card()).toHaveTextContent("2 days over goal");
  });

  it("gives the current run of Logged Days under the Goal", () => {
    render(
      <GoalCard
        totals={totals}
        history={totals}
        range={range}
        goal={2000}
        today={TODAY}
      />,
    );

    // 2 Nov and 3 Nov; 1 Nov was not logged.
    expect(card()).toHaveTextContent("2 days in a row under goal");
  });

  it("uses the singular for one day", () => {
    const one = [total("2026-11-03", 1700)];
    render(
      <GoalCard
        totals={one}
        history={one}
        range={range}
        goal={2000}
        today={TODAY}
      />,
    );

    expect(card()).toHaveTextContent("1 day under goal");
    expect(card()).toHaveTextContent("1 day in a row under goal");
  });

  it("says there is no run when the latest Day was over", () => {
    const over = [total("2026-11-02", 1800), total("2026-11-03", 2600)];
    render(
      <GoalCard
        totals={over}
        history={over}
        range={range}
        goal={2000}
        today={TODAY}
      />,
    );

    expect(card()).toHaveTextContent("No run under goal right now");
  });

  it("counts the run across the whole history, not just the Period", () => {
    const history = listDays("2026-10-20", TODAY).map((d) => total(d, 1800));
    const justToday = history.filter((t) => t.day === TODAY);
    render(
      <GoalCard
        totals={justToday}
        history={history}
        range={range}
        goal={2000}
        today={TODAY}
      />,
    );

    expect(card()).toHaveTextContent("15 days in a row under goal");
  });

  it("says what is needed when nothing was logged in the Period", () => {
    render(
      <GoalCard
        totals={[]}
        history={[]}
        range={range}
        goal={2000}
        today={TODAY}
      />,
    );

    expect(card()).toHaveTextContent("Not enough data yet");
    expect(card()).toHaveTextContent("No logged days in this period");
  });
});

describe("StreakCard", () => {
  const card = () => screen.getByRole("region", { name: "Logging streak" });

  it("gives the current and the longest run", () => {
    const history = [
      ...["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((d) =>
        total(d),
      ),
      ...["2026-11-02", "2026-11-03"].map((d) => total(d)),
    ];
    render(<StreakCard history={history} today={TODAY} />);

    expect(card()).toHaveTextContent("2 days");
    expect(card()).toHaveTextContent("Current streak");
    expect(card()).toHaveTextContent("Longest streak");
    expect(card()).toHaveTextContent("4 days");
  });

  it("carries on from yesterday when today is not logged yet", () => {
    render(
      <StreakCard
        history={[total("2026-11-01"), total("2026-11-02")]}
        today={TODAY}
      />,
    );

    expect(card()).toHaveTextContent("Current streak");
    expect(card()).toHaveTextContent("2 days");
  });

  it("invites logging when there is no current streak", () => {
    render(
      <StreakCard
        history={[total("2026-10-01"), total("2026-10-02")]}
        today={TODAY}
      />,
    );

    expect(card()).toHaveTextContent("No current streak");
    expect(card()).toHaveTextContent("Log what you ate today");
  });

  it("says so when nothing has ever been logged", () => {
    render(<StreakCard history={[]} today={TODAY} />);

    expect(card()).toHaveTextContent("No streak yet");
  });

  it("states the key numbers as one sentence for screen readers", () => {
    render(
      <StreakCard
        history={[total("2026-11-02"), total("2026-11-03")]}
        today={TODAY}
      />,
    );

    expect(
      screen.getByText("Current streak 2 days, longest streak 2 days", {
        selector: ".sr-only",
      }),
    ).toBeInTheDocument();
  });
});
