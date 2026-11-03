import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const usePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

import { BottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  beforeEach(() => usePathname.mockReset());

  it("shows only the tabs whose features have shipped", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Today",
      "Settings",
    ]);
  });

  it("marks Today as the current page on the home route", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Settings as current on its route and nested routes", () => {
    usePathname.mockReturnValue("/settings/about");
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Today" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("is labelled as the main navigation", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav />);

    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
  });
});
