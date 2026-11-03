import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddFoodSheet } from "./add-food-sheet";
import type { Food } from "./types";

function open(foods: Food[] = []) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <AddFoodSheet open foods={foods} onSave={onSave} onClose={onClose} />,
  );
  return { onSave, onClose, ...view };
}

async function enterManually() {
  await userEvent.click(
    screen.getByRole("button", { name: /enter manually/i }),
  );
}

describe("AddFoodSheet", () => {
  it("starts by offering ways to add a Food", () => {
    open();

    expect(
      screen.getByRole("heading", { name: "Add food" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enter manually/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("opens the form with the name field focused and the numeric keypad for calories", async () => {
    open();

    await enterManually();

    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(screen.getByLabelText("Calories")).toHaveAttribute(
      "inputmode",
      "numeric",
    );
  });

  it("saves the Food and closes", async () => {
    const { onSave, onClose } = open();
    await enterManually();

    await userEvent.type(screen.getByLabelText("Name"), "Toast");
    await userEvent.click(screen.getByRole("button", { name: "1 slice" }));
    await userEvent.type(screen.getByLabelText("Calories"), "110");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({
      name: "Toast",
      portion: "1 slice",
      calories: 110,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the sheet open for 'Save and add another'", async () => {
    const { onSave, onClose } = open();
    await enterManually();

    await userEvent.type(screen.getByLabelText("Name"), "Toast");
    await userEvent.click(screen.getByRole("button", { name: "1 slice" }));
    await userEvent.type(screen.getByLabelText("Calories"), "110");
    await userEvent.click(
      screen.getByRole("button", { name: "Save and add another" }),
    );

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("refuses a duplicate of a Food already in the list", async () => {
    const existing: Food = {
      id: "1",
      name: "Toast",
      portion: "1 slice",
      calories: 110,
      archivedAt: null,
    };
    const { onSave } = open([existing]);
    await enterManually();

    await userEvent.type(screen.getByLabelText("Name"), "toast");
    await userEvent.click(screen.getByRole("button", { name: "1 slice" }));
    await userEvent.type(screen.getByLabelText("Calories"), "999");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("You already have Toast (1 slice)"),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("goes back to the choices when reopened", async () => {
    const { rerender, onSave, onClose } = open();
    await enterManually();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();

    rerender(
      <AddFoodSheet
        open={false}
        foods={[]}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    rerender(
      <AddFoodSheet open foods={[]} onSave={onSave} onClose={onClose} />,
    );

    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enter manually/i }),
    ).toBeInTheDocument();
  });
});

describe("AddFoodSheet: a duplicate Food", () => {
  it("lets the User jump to editing the Food they already have", async () => {
    const existing: Food = {
      id: "1",
      name: "Toast",
      portion: "1 slice",
      calories: 110,
      archivedAt: null,
    };
    const onEditExisting = vi.fn();
    render(
      <AddFoodSheet
        open
        foods={[existing]}
        onSave={vi.fn()}
        onEditExisting={onEditExisting}
        onClose={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /enter manually/i }),
    );

    await userEvent.type(screen.getByLabelText("Name"), "Toast");
    await userEvent.click(screen.getByRole("button", { name: "1 slice" }));
    await userEvent.type(screen.getByLabelText("Calories"), "999");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit Toast" }));

    expect(onEditExisting).toHaveBeenCalledWith(existing);
  });
});
