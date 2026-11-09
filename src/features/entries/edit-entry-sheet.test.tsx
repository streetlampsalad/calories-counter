import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mealTimesOn = vi.fn(() => true);
vi.mock("@/features/toggles/queries", () => ({
  useToggle: () => mealTimesOn(),
}));

import { EditEntrySheet } from "./edit-entry-sheet";
import type { Entry } from "./types";

const toast: Entry = {
  id: "e1",
  day: "2026-11-03",
  quantity: 1.5,
  createdAt: "2026-11-03T08:00:00Z",
  food: {
    id: "toast",
    name: "Sourdough toast",
    portion: "1 slice",
    calories: 110,
  },
};

function open(entry: Entry | null = toast) {
  const onChange = vi.fn();
  const onChangeMealTime = vi.fn();
  const onRemove = vi.fn();
  const onClose = vi.fn();
  render(
    <EditEntrySheet
      entry={entry}
      onChange={onChange}
      onChangeMealTime={onChangeMealTime}
      onRemove={onRemove}
      onClose={onClose}
    />,
  );
  return { onChange, onChangeMealTime, onRemove, onClose };
}

describe("EditEntrySheet", () => {
  beforeEach(() => mealTimesOn.mockReturnValue(true));

  it("stays closed without an Entry", () => {
    open(null);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says which Entry is being changed, and what it is now", () => {
    open();

    expect(
      screen.getByRole("heading", { name: "Edit entry" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sourdough toast")).toBeInTheDocument();
    expect(screen.getByText("1½ × 1 slice · 165 kcal")).toBeInTheDocument();
  });

  it("changes the Quantity in one tap, then closes", async () => {
    const { onChange, onClose } = open();

    await userEvent.click(screen.getByRole("button", { name: "Set to 3" }));

    expect(onChange).toHaveBeenCalledWith(toast, 3);
    expect(onClose).toHaveBeenCalled();
  });

  it("starts the stepper from the current Quantity", async () => {
    const { onChange } = open();

    expect(screen.getByRole("status")).toHaveTextContent("1½");
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Set to 2 portions" }),
    );

    expect(onChange).toHaveBeenCalledWith(toast, 2);
  });

  it("removes the Entry without asking, since Undo is offered", async () => {
    const { onRemove, onClose } = open();

    await userEvent.click(screen.getByRole("button", { name: "Remove entry" }));

    expect(onRemove).toHaveBeenCalledWith(toast);
    expect(onClose).toHaveBeenCalled();
  });

  describe("Meal time (spec 174)", () => {
    it("shows the four chips with the Entry's Meal time chosen (US3.1)", () => {
      open({ ...toast, mealTime: "lunch" });

      for (const name of ["Breakfast", "Lunch", "Dinner", "Snack"]) {
        expect(screen.getByRole("button", { name })).toBeInTheDocument();
      }
      expect(screen.getByRole("button", { name: "Lunch" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "Dinner" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("shows no chip chosen for an untagged Entry (US3.1)", () => {
      open();

      expect(screen.getByRole("button", { name: "Lunch" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("changes the Meal time, then closes (US3.2)", async () => {
      const entry: Entry = { ...toast, mealTime: "lunch" };
      const { onChangeMealTime, onClose } = open(entry);

      await userEvent.click(screen.getByRole("button", { name: "Dinner" }));

      expect(onChangeMealTime).toHaveBeenCalledWith(entry, "dinner");
      expect(onClose).toHaveBeenCalled();
    });

    it("clears the Meal time when the chosen chip is tapped (US3.2)", async () => {
      const entry: Entry = { ...toast, mealTime: "lunch" };
      const { onChangeMealTime } = open(entry);

      await userEvent.click(screen.getByRole("button", { name: "Lunch" }));

      expect(onChangeMealTime).toHaveBeenCalledWith(entry, null);
    });

    it("shows no chips when the Toggle is off (US3.3)", () => {
      mealTimesOn.mockReturnValue(false);
      open({ ...toast, mealTime: "lunch" });

      expect(
        screen.queryByRole("button", { name: "Lunch" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Meal time")).not.toBeInTheDocument();
    });
  });
});
