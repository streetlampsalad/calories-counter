import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RemoveFoodsSheet } from "./remove-foods-sheet";
import type { Food } from "./types";

const food = (id: string): Food => ({
  id,
  name: id,
  portion: "1 serve",
  calories: 100,
  archivedAt: null,
});

function open(counts: Record<string, number> | undefined = { a: 3, b: 0 }) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <RemoveFoodsSheet
      open
      foods={[food("a"), food("b")]}
      entryCounts={counts}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );
  return { onConfirm, onClose };
}

describe("RemoveFoodsSheet", () => {
  it("asks, and spells out what will happen to each kind of Food", () => {
    open();

    expect(
      screen.getByRole("dialog", { name: "Remove 2 foods?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 you've logged will be archived, 1 will be deleted."),
    ).toBeInTheDocument();
  });

  it("removes when confirmed", async () => {
    const { onConfirm } = open();

    await userEvent.click(
      screen.getByRole("button", { name: "Remove 2 foods" }),
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("changes nothing when cancelled", async () => {
    const { onConfirm, onClose } = open();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("still asks before the counts have loaded", () => {
    open(undefined);

    expect(
      screen.getByRole("dialog", { name: "Remove 2 foods?" }),
    ).toBeInTheDocument();
  });

  it("has phone-sized buttons", () => {
    open();

    for (const name of ["Remove 2 foods", "Cancel"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("h-12");
    }
  });
});
