import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
  const onRemove = vi.fn();
  const onClose = vi.fn();
  render(
    <EditEntrySheet
      entry={entry}
      onChange={onChange}
      onRemove={onRemove}
      onClose={onClose}
    />,
  );
  return { onChange, onRemove, onClose };
}

describe("EditEntrySheet", () => {
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
});
