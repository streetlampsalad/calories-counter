import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TodayPill } from "./today-pill";

describe("TodayPill", () => {
  it("is a Today button you can tap when it is visible (AC-2)", async () => {
    const onClick = vi.fn();
    render(<TodayPill visible onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: "Today" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is at least 44 px tall (AC-2)", () => {
    render(<TodayPill visible onClick={() => {}} />);

    // h-12 is 3rem: 48 px.
    expect(screen.getByRole("button", { name: "Today" })).toHaveClass("h-12");
  });

  it("is out of reach for taps, keys and screen readers when it is hidden (AC-2)", () => {
    render(<TodayPill visible={false} onClick={() => {}} />);

    const pill = screen.getByRole("button", { name: "Today", hidden: true });
    // jsdom has no stylesheet, so this checks the classes that hide it in a real browser.
    expect(pill).toHaveClass("invisible", "pointer-events-none", "opacity-0");
  });

  it("stays in the page when hidden, so it can fade and take no layout with it (AC-2)", () => {
    const { rerender } = render(<TodayPill visible onClick={() => {}} />);
    const shown = screen.getByRole("button", { name: "Today" });

    rerender(<TodayPill visible={false} onClick={() => {}} />);

    expect(screen.getByRole("button", { name: "Today", hidden: true })).toBe(
      shown,
    );
  });

  it("fades rather than snaps, but not for a User who asks for reduced motion (AC-2, AC-8)", () => {
    render(<TodayPill visible onClick={() => {}} />);
    const pill = screen.getByRole("button", { name: "Today" });

    expect(pill).toHaveClass(
      "transition-[opacity,visibility]",
      "duration-200",
      "motion-reduce:transition-none",
    );
    expect(pill).not.toHaveClass("transition-all");
  });
});
