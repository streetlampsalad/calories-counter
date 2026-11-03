import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useSettings = vi.fn();
const mutate = vi.fn();
vi.mock("./queries", () => ({
  useSettings: () => useSettings(),
  useUpdateSettings: () => ({ mutate }),
}));

import { WeekStartSection } from "./week-start-section";

describe("WeekStartSection", () => {
  beforeEach(() => {
    useSettings.mockReset();
    mutate.mockReset();
    useSettings.mockReturnValue({
      data: { dailyGoal: null, weekStartsOn: 1 },
      isPending: false,
    });
  });

  it("offers Monday and Sunday, with Monday chosen by default", () => {
    render(<WeekStartSection />);

    const group = screen.getByRole("group", { name: "Week starts on" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monday" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Sunday" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows Sunday when that is the saved choice", () => {
    useSettings.mockReturnValue({
      data: { dailyGoal: null, weekStartsOn: 0 },
      isPending: false,
    });
    render(<WeekStartSection />);

    expect(screen.getByRole("button", { name: "Sunday" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Monday" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("saves the new choice when the other day is tapped", async () => {
    render(<WeekStartSection />);

    await userEvent.click(screen.getByRole("button", { name: "Sunday" }));

    expect(mutate).toHaveBeenCalledWith(
      { weekStartsOn: 0 },
      expect.any(Object),
    );
  });

  it("saves nothing when the chosen day is tapped again", async () => {
    render(<WeekStartSection />);

    await userEvent.click(screen.getByRole("button", { name: "Monday" }));

    expect(mutate).not.toHaveBeenCalled();
  });

  it("explains what it affects", () => {
    render(<WeekStartSection />);

    expect(screen.getByText(/this week and last week/i)).toBeInTheDocument();
  });

  it("shows a placeholder while settings load", () => {
    useSettings.mockReturnValue({ data: undefined, isPending: true });
    render(<WeekStartSection />);

    expect(
      screen.queryByRole("button", { name: "Monday" }),
    ).not.toBeInTheDocument();
  });

  it("has phone-sized buttons", () => {
    render(<WeekStartSection />);

    expect(screen.getByRole("button", { name: "Monday" })).toHaveClass(
      "min-h-12",
    );
  });
});
