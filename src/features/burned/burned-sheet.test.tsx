import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BurnedSheet } from "./burned-sheet";

const onSave = vi.fn();
const onClose = vi.fn();

function open(current: number | null = null) {
  render(
    <BurnedSheet open current={current} onSave={onSave} onClose={onClose} />,
  );
}
const field = () => screen.getByLabelText("Calories burned (kcal)");

describe("BurnedSheet", () => {
  beforeEach(() => {
    onSave.mockReset();
    onClose.mockReset();
  });

  it("starts empty when there is no figure, with no Clear button (AC-4)", () => {
    open(null);

    expect(field()).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: "Clear" }),
    ).not.toBeInTheDocument();
  });

  it("starts from the saved figure, with a Clear button (AC-4)", () => {
    open(2450);

    expect(field()).toHaveValue("2450");
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("saves a figure in range and closes (AC-4)", async () => {
    open(null);

    await userEvent.type(field(), "2450");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(2450);
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    "499",
    "10001",
    "abc",
    "",
    "24.5",
  ])("refuses %j with the range, and saves nothing (AC-4)", async (text) => {
    open(null);

    if (text) await userEvent.type(field(), text);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Enter between 500 and 10,000 kcal"),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("takes the message away once you start typing again", async () => {
    open(null);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Enter between 500 and 10,000 kcal"),
    ).toBeInTheDocument();

    await userEvent.type(field(), "2");

    expect(
      screen.queryByText("Enter between 500 and 10,000 kcal"),
    ).not.toBeInTheDocument();
  });

  it("clears the figure with null and closes (AC-4)", async () => {
    open(2450);

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(onSave).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalled();
  });
});
