import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SelectionBar } from "./selection-bar";

function open(count = 3) {
  const onSelectAll = vi.fn();
  const onDelete = vi.fn();
  const onClear = vi.fn();
  render(
    <SelectionBar
      count={count}
      onSelectAll={onSelectAll}
      onDelete={onDelete}
      onClear={onClear}
    />,
  );
  return { onSelectAll, onDelete, onClear };
}

describe("SelectionBar", () => {
  it("says how many are selected", () => {
    open(3);

    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });

  it("offers Select all, Delete and a way out", async () => {
    const { onSelectAll, onDelete, onClear } = open();

    await userEvent.click(screen.getByRole("button", { name: "Select all" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Cancel selection" }),
    );

    expect(onSelectAll).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("has touch targets of at least 44 px", () => {
    open();

    for (const name of ["Select all", "Delete", "Cancel selection"]) {
      expect(screen.getByRole("button", { name }).className).toMatch(
        /\b(h-11|size-11)\b/,
      );
    }
  });
});
