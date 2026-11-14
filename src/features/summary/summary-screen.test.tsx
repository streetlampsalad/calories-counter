import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("period=this-month"),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("@/features/entries/use-today", () => ({
  useToday: () => "2026-11-13",
}));
vi.mock("@/features/settings/queries", () => ({
  useSettings: () => ({ data: undefined, isPending: false }),
}));
vi.mock("./queries", () => ({
  usePeriodDays: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock("./period-chips", () => ({ PeriodChips: () => null }));
vi.mock("@/features/nutrition-tips/tips-card", () => ({
  TipsCard: ({
    today,
    weekStartsOn,
  }: {
    today: string;
    weekStartsOn: number;
  }) => (
    <section aria-label="Nutrition tips">
      {today} {weekStartsOn}
    </section>
  ),
}));

import { SummaryScreen } from "./summary-screen";

describe("SummaryScreen Nutrition tips", () => {
  it("shows the Nutrition tips card whichever Period is chosen (US1.1)", () => {
    render(<SummaryScreen />);

    expect(
      screen.getByRole("region", { name: "Nutrition tips" }),
    ).toBeInTheDocument();
  });
});
