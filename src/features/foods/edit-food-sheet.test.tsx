import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useFoodEntryCounts = vi.fn();
vi.mock("./queries", () => ({
  useFoodEntryCounts: (enabled: boolean) => useFoodEntryCounts(enabled),
}));

import { EditFoodSheet } from "./edit-food-sheet";
import type { Food } from "./types";

const toast: Food = {
  id: "toast",
  name: "Toast",
  portion: "1 slice",
  calories: 110,
  archivedAt: null,
};
const rice: Food = {
  id: "rice",
  name: "Rice",
  portion: "100 g",
  calories: 130,
  archivedAt: null,
};

function open(
  overrides: Partial<React.ComponentProps<typeof EditFoodSheet>> = {},
) {
  const onSave = vi.fn();
  render(
    <EditFoodSheet
      food={toast}
      foods={[toast, rice]}
      onSave={onSave}
      onClose={vi.fn()}
      {...overrides}
    />,
  );
  return { onSave };
}

describe("EditFoodSheet", () => {
  beforeEach(() => {
    useFoodEntryCounts.mockReset();
    useFoodEntryCounts.mockReturnValue({ data: { toast: 0 } });
  });

  it("opens with the Food's current values", () => {
    open();

    expect(screen.getByLabelText("Name")).toHaveValue("Toast");
    expect(screen.getByLabelText("Portion")).toHaveValue("1 slice");
    expect(screen.getByLabelText("Calories")).toHaveValue("110");
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });

  it("saves the changes against the same Food", async () => {
    const { onSave } = open();

    await userEvent.clear(screen.getByLabelText("Calories"));
    await userEvent.type(screen.getByLabelText("Calories"), "150");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith({ ...toast, calories: 150 });
  });

  it("allows keeping the same name and Portion while changing the calories", async () => {
    const { onSave } = open();

    await userEvent.clear(screen.getByLabelText("Calories"));
    await userEvent.type(screen.getByLabelText("Calories"), "120");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalled();
    expect(screen.queryByText(/you already have/i)).not.toBeInTheDocument();
  });

  it("refuses to become a copy of another Food", async () => {
    const { onSave } = open();

    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "rice");
    await userEvent.clear(screen.getByLabelText("Portion"));
    await userEvent.type(screen.getByLabelText("Portion"), "100 G");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      screen.getByText("You already have Rice (100 g)"),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each([
    [1, "Changing this updates 1 past Entry"],
    [3, "Changing this updates 3 past Entries"],
    [1204, "Changing this updates 1,204 past Entries"],
  ])("warns that history changes when the Food has %i Entries", (count, message) => {
    useFoodEntryCounts.mockReturnValue({ data: { toast: count } });
    open();

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("says nothing about history when the Food has no Entries", () => {
    open();

    expect(screen.queryByText(/past entr/i)).not.toBeInTheDocument();
  });

  it("only asks for counts while a Food is being edited", () => {
    open({ food: null });

    expect(useFoodEntryCounts).toHaveBeenCalledWith(false);
  });
});
