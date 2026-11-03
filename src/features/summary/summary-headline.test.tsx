import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Summary } from "./summarise";

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

import { SummaryHeadline } from "./summary-headline";

const summary = (overrides: Partial<Summary> = {}): Summary => ({
  total: 6000,
  loggedDays: 3,
  daysInRange: 7,
  averagePerLoggedDay: 2000,
  overGoalDays: 0,
  averageVsGoal: null,
  ...overrides,
});

const region = () => screen.getByRole("region", { name: "Summary totals" });

describe("SummaryHeadline", () => {
  it("leads with the total, then the average per logged day and how many days were logged", () => {
    render(<SummaryHeadline summary={summary()} goal={null} />);

    expect(region()).toHaveTextContent("6,000");
    expect(region()).toHaveTextContent("kcal total");
    expect(region()).toHaveTextContent("Average 2,000 kcal per logged day");
    expect(region()).toHaveTextContent("3 of 7 days logged");
  });

  it("uses thousands separators", () => {
    render(
      <SummaryHeadline
        summary={summary({ total: 123456, averagePerLoggedDay: 41152 })}
        goal={null}
      />,
    );

    expect(region()).toHaveTextContent("123,456");
    expect(region()).toHaveTextContent("41,152");
  });

  it("says 'day' for a Period of one day", () => {
    render(
      <SummaryHeadline
        summary={summary({
          loggedDays: 1,
          daysInRange: 1,
          total: 1900,
          averagePerLoggedDay: 1900,
        })}
        goal={null}
      />,
    );

    expect(region()).toHaveTextContent("1 of 1 day logged");
  });

  it("says nothing about a Goal when there is none", () => {
    render(<SummaryHeadline summary={summary()} goal={null} />);

    expect(region()).not.toHaveTextContent(/goal/i);
  });

  it("says how far under the Goal the average is", () => {
    render(
      <SummaryHeadline
        summary={summary({ averageVsGoal: -180 })}
        goal={2200}
      />,
    );

    expect(region()).toHaveTextContent("180 kcal under goal on average");
  });

  it("says how far over the Goal the average is", () => {
    render(
      <SummaryHeadline summary={summary({ averageVsGoal: 300 })} goal={2200} />,
    );

    expect(region()).toHaveTextContent("300 kcal over goal on average");
  });

  it("says when the average is right on the Goal", () => {
    render(
      <SummaryHeadline summary={summary({ averageVsGoal: 0 })} goal={2000} />,
    );

    expect(region()).toHaveTextContent("Right on your goal on average");
  });

  it("counts the logged days that went over the Goal", () => {
    render(
      <SummaryHeadline
        summary={summary({ averageVsGoal: -50, overGoalDays: 2 })}
        goal={2200}
      />,
    );

    expect(region()).toHaveTextContent("Over goal on 2 of 3 logged days");
  });

  it("uses the singular for a single logged day", () => {
    render(
      <SummaryHeadline
        summary={summary({ loggedDays: 1, averageVsGoal: 10, overGoalDays: 1 })}
        goal={2200}
      />,
    );

    expect(region()).toHaveTextContent("Over goal on 1 of 1 logged day");
  });

  it("explains an empty Period and points to Today", () => {
    render(
      <SummaryHeadline
        summary={summary({
          total: 0,
          loggedDays: 0,
          averagePerLoggedDay: null,
        })}
        goal={2200}
      />,
    );

    expect(
      screen.getByText("Nothing logged in this period"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Today" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("region", { name: "Summary totals" }),
    ).not.toBeInTheDocument();
  });
});
