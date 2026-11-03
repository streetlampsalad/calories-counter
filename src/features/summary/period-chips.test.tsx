import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    replace: _replace,
    scroll: _scroll,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    replace?: boolean;
    scroll?: boolean;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PeriodChips } from "./period-chips";

describe("PeriodChips", () => {
  it("lists the five Periods in order, each a 44 px touch target", () => {
    render(<PeriodChips selected="this-week" />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "This week",
      "Last week",
      "This month",
      "Last month",
      "Last 30 days",
    ]);
    for (const link of links) expect(link).toHaveClass("min-h-11");
  });

  it("leaves space under the chips so the scroll bar does not touch them", () => {
    render(<PeriodChips selected="this-week" />);

    const list = screen.getByRole("list");
    expect(list).toHaveClass("overflow-x-auto");
    expect(list).toHaveClass("pb-3");
  });
});
