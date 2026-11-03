import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FoodForm } from "./food-form";
import type { Food } from "./types";

async function fill(name: string, portion: string, calories: string) {
  await userEvent.type(screen.getByLabelText("Name"), name);
  await userEvent.type(screen.getByLabelText("Portion"), portion);
  await userEvent.type(screen.getByLabelText("Calories"), calories);
}

describe("FoodForm", () => {
  it("submits a valid Food with its values cleaned up", async () => {
    const onSubmit = vi.fn();
    render(<FoodForm onSubmit={onSubmit} />);

    await fill("  Sourdough   toast ", "1 slice", "110");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Sourdough toast",
      portion: "1 slice",
      calories: 110,
    });
  });

  it("shows what is wrong, and submits nothing, when the form is empty", async () => {
    const onSubmit = vi.fn();
    render(<FoodForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Enter a name")).toBeInTheDocument();
    expect(
      screen.getByText("Enter a portion, like 1 slice or 100 g"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Calories must be a whole number from 0 to 9,999"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("marks the failing fields as invalid for assistive technology", async () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByLabelText("Name")).toBeInvalid();
    expect(screen.getByLabelText("Calories")).toBeInvalid();
  });

  it("uses the numeric keypad for calories", () => {
    render(<FoodForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Calories")).toHaveAttribute(
      "inputmode",
      "numeric",
    );
  });

  it("refuses a Food that duplicates one in the list, naming it", async () => {
    const existing: Food = {
      id: "1",
      name: "Sourdough toast",
      portion: "1 slice",
      calories: 110,
      archivedAt: null,
    };
    const onSubmit = vi.fn();
    render(<FoodForm onSubmit={onSubmit} findExisting={() => existing} />);

    await fill("sourdough TOAST", "1 slice", "120");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("You already have Sourdough toast (1 slice)"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("starts from initial values and a custom button label", () => {
    render(
      <FoodForm
        submitLabel="Save changes"
        initialValues={{ name: "Rice", portion: "100 g", calories: "130" }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Rice");
    expect(screen.getByLabelText("Calories")).toHaveValue("130");
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });
});
