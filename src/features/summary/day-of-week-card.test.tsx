import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { listDays } from "@/features/entries/days";
import { DayOfWeekCard } from "./day-of-week-card";
import type { PeriodRange } from "./period";
import type { DayTotal } from "./summarise";

// Mon 5 Oct to Sun 1 Nov 2026: four whole weeks.
const range: PeriodRange = {
  from: "2026-10-05",
  to: "2026-11-01",
  days: listDays("2026-10-05", "2026-11-01"),
};
const saturdayHeavy: DayTotal[] = range.days.map((day) => ({
  day,
  calories: new Date(`${day}T00:00:00Z`).getUTCDay() === 6 ? 2600 : 1800,
  entryCount: 1,
}));

const card = () => screen.getByRole("region", { name: "Day of week" });
const rows = () =>
  within(screen.getByRole("list", { name: "Average by weekday" })).getAllByRole(
    "listitem",
  );

describe("DayOfWeekCard", () => {
  it("calls out the highest weekday in words", () => {
    render(
      <DayOfWeekCard totals={saturdayHeavy} range={range} weekStartsOn={1} />,
    );

    expect(card()).toHaveTextContent("Saturdays average 2,600 kcal");
  });

  it("lists every weekday from the week start, each with its average as text", () => {
    render(
      <DayOfWeekCard totals={saturdayHeavy} range={range} weekStartsOn={1} />,
    );

    expect(rows()).toHaveLength(7);
    expect(rows()[0]).toHaveTextContent("Mon");
    expect(rows()[0]).toHaveTextContent("1,800 kcal");
    expect(rows()[5]).toHaveTextContent("Sat");
    expect(rows()[5]).toHaveTextContent("2,600 kcal");
    expect(rows()[6]).toHaveTextContent("Sun");
  });

  it("starts the list on Sunday when the week starts on Sunday", () => {
    render(
      <DayOfWeekCard totals={saturdayHeavy} range={range} weekStartsOn={0} />,
    );

    expect(rows()[0]).toHaveTextContent("Sun");
    expect(rows()[6]).toHaveTextContent("Sat");
  });

  it("marks the highest weekday in text, not only by colour", () => {
    render(
      <DayOfWeekCard totals={saturdayHeavy} range={range} weekStartsOn={1} />,
    );

    expect(rows()[5]).toHaveTextContent("Highest");
    expect(rows()[0]).not.toHaveTextContent("Highest");
  });

  it("says a weekday was not logged rather than showing zero", () => {
    const withoutSaturdays = saturdayHeavy.filter(
      (t) => new Date(`${t.day}T00:00:00Z`).getUTCDay() !== 6,
    );
    render(
      <DayOfWeekCard
        totals={withoutSaturdays}
        range={range}
        weekStartsOn={1}
      />,
    );

    expect(rows()[5]).toHaveTextContent("Not logged");
    expect(rows()[5]).not.toHaveTextContent("0 kcal");
  });

  it("says what is needed when there is too little data", () => {
    render(
      <DayOfWeekCard
        totals={saturdayHeavy.slice(0, 5)}
        range={range}
        weekStartsOn={1}
      />,
    );

    expect(card()).toHaveTextContent("Not enough data yet");
    expect(card()).toHaveTextContent("5 of 14 days logged so far");
    expect(
      screen.queryByRole("list", { name: "Average by weekday" }),
    ).not.toBeInTheDocument();
  });
});
