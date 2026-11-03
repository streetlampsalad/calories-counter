import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuantityPicker } from "./quantity-picker";

describe("QuantityPicker", () => {
  it("offers one-tap amounts: ½, 1, 1½, 2 and 3", () => {
    render(<QuantityPicker onChoose={vi.fn()} />);

    for (const label of ["Add ½", "Add 1", "Add 1½", "Add 2", "Add 3"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it.each([
    ["Add ½", 0.5],
    ["Add 1", 1],
    ["Add 1½", 1.5],
    ["Add 2", 2],
    ["Add 3", 3],
  ])("%s adds that Quantity in a single tap", async (label, quantity) => {
    const onChoose = vi.fn();
    render(<QuantityPicker onChoose={onChoose} />);

    await userEvent.click(screen.getByRole("button", { name: label }));

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(quantity);
  });

  it("steps in halves for any other amount, then adds it", async () => {
    const onChoose = vi.fn();
    render(<QuantityPicker onChoose={onChoose} />);

    await userEvent.click(screen.getByRole("button", { name: "More" }));
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    await userEvent.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByRole("status")).toHaveTextContent("2½");
    await userEvent.click(
      screen.getByRole("button", { name: "Add 2½ portions" }),
    );
    expect(onChoose).toHaveBeenCalledWith(2.5);
  });

  it("starts the stepper at one portion", () => {
    render(<QuantityPicker onChoose={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("1");
    expect(
      screen.getByRole("button", { name: "Add 1 portion" }),
    ).toBeInTheDocument();
  });

  it("cannot go below half a portion", async () => {
    render(<QuantityPicker onChoose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Less" }));
    expect(screen.getByRole("status")).toHaveTextContent("½");
    expect(screen.getByRole("button", { name: "Less" })).toBeDisabled();
  });

  it("cannot go above 20", async () => {
    render(<QuantityPicker onChoose={vi.fn()} />);

    for (let i = 0; i < 39; i++) {
      await userEvent.click(screen.getByRole("button", { name: "More" }));
    }
    expect(screen.getByRole("status")).toHaveTextContent("20");
    expect(screen.getByRole("button", { name: "More" })).toBeDisabled();
  });
});
