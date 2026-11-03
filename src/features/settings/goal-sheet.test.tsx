import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GoalSheet } from "./goal-sheet";

function open(current: number | null = null) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <GoalSheet open current={current} onSave={onSave} onClose={onClose} />,
  );
  return { onSave, onClose };
}

describe("GoalSheet", () => {
  it("asks for calories a day, with the numeric keypad and the allowed range", () => {
    open();

    const input = screen.getByLabelText("Calories per day");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveValue("");
    expect(screen.getByText(/between 500 and 10,000/i)).toBeInTheDocument();
  });

  it("focuses the field so the keypad is up straight away", () => {
    open();

    expect(screen.getByLabelText("Calories per day")).toHaveFocus();
  });

  it("starts from the current Goal", () => {
    open(2200);

    expect(screen.getByLabelText("Calories per day")).toHaveValue("2200");
  });

  it("saves a valid Goal and closes", async () => {
    const { onSave, onClose } = open();

    await userEvent.type(screen.getByLabelText("Calories per day"), "2000");
    await userEvent.click(screen.getByRole("button", { name: "Save goal" }));

    expect(onSave).toHaveBeenCalledWith(2000);
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    "",
    "abc",
    "499",
    "10001",
    "2200.5",
  ])("refuses %j, saying what is allowed, and saves nothing", async (text) => {
    const { onSave, onClose } = open();

    if (text)
      await userEvent.type(screen.getByLabelText("Calories per day"), text);
    await userEvent.click(screen.getByRole("button", { name: "Save goal" }));

    expect(
      screen.getByText("Enter a goal between 500 and 10,000 calories"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Calories per day")).toBeInvalid();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("saves with the Enter key", async () => {
    const { onSave } = open();

    await userEvent.type(
      screen.getByLabelText("Calories per day"),
      "1800{Enter}",
    );

    expect(onSave).toHaveBeenCalledWith(1800);
  });

  it("clears the Goal", async () => {
    const { onSave, onClose } = open(2200);

    await userEvent.click(screen.getByRole("button", { name: "Clear goal" }));

    expect(onSave).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalled();
  });

  it("offers nothing to clear when there is no Goal", () => {
    open(null);

    expect(
      screen.queryByRole("button", { name: "Clear goal" }),
    ).not.toBeInTheDocument();
  });
});
