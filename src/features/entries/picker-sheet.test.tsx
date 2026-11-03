import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Food } from "@/features/foods/types";

const useFoods = vi.fn();
vi.mock("@/features/foods/queries", () => ({ useFoods: () => useFoods() }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { FoodPickerSheet } from "./picker-sheet";

const food = (name: string, portion = "1 slice", calories = 100): Food => ({
  id: name,
  name,
  portion,
  calories,
  archivedAt: null,
});
const apple = food("Apple", "1 piece", 80);
const toast = food("Sourdough toast", "1 slice", 110);
const latte = food("Café latte", "250 ml", 120);

function open() {
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(<FoodPickerSheet open onPick={onPick} onClose={onClose} />);
  return { onPick, onClose };
}

describe("FoodPickerSheet", () => {
  beforeEach(() => {
    useFoods.mockReset();
    useFoods.mockReturnValue({
      data: [apple, latte, toast],
      isPending: false,
      isError: false,
    });
  });

  it("lists the Food List, each with its Portion and calories", () => {
    open();

    const list = screen.getByRole("list", { name: "Your foods" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Apple"),
      expect.stringContaining("Café latte"),
      expect.stringContaining("Sourdough toast"),
    ]);
    expect(rows[2]).toHaveTextContent("1 slice · 110 kcal");
  });

  it("filters as the User types, ignoring case and accents", async () => {
    open();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search foods" }),
      "CAFE",
    );

    const rows = within(
      screen.getByRole("list", { name: "Your foods" }),
    ).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Café latte");
  });

  it("says when nothing matches", async () => {
    open();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search foods" }),
      "zzzz",
    );

    expect(screen.getByText(/No foods match/)).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Your foods" }),
    ).not.toBeInTheDocument();
  });

  it("shows the Quantity buttons for a Food only once it is tapped", async () => {
    open();
    expect(
      screen.queryByRole("button", { name: "Add 1½" }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Sourdough toast/ }),
    );

    expect(screen.getByRole("button", { name: "Add 1½" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sourdough toast/ }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("opens one Food at a time", async () => {
    open();

    await userEvent.click(screen.getByRole("button", { name: /Apple/ }));
    await userEvent.click(
      screen.getByRole("button", { name: /Sourdough toast/ }),
    );

    expect(screen.getAllByRole("button", { name: "Add 1½" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Apple/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("picks the Food and Quantity in two taps and closes", async () => {
    const { onPick, onClose } = open();

    await userEvent.click(
      screen.getByRole("button", { name: /Sourdough toast/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Add 1½" }));

    expect(onPick).toHaveBeenCalledWith(toast, 1.5);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes the open Food when the search changes", async () => {
    open();
    await userEvent.click(
      screen.getByRole("button", { name: /Sourdough toast/ }),
    );

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search foods" }),
      "a",
    );

    expect(
      screen.queryByRole("button", { name: "Add 1½" }),
    ).not.toBeInTheDocument();
  });

  it("points a User with no Foods to adding one", () => {
    useFoods.mockReturnValue({ data: [], isPending: false, isError: false });
    open();

    expect(screen.getByText("You have no foods yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Add your first food" }),
    ).toHaveAttribute("href", "/foods");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("shows a placeholder while the Food List loads", () => {
    useFoods.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    open();

    expect(screen.queryByText("You have no foods yet")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Your foods" }),
    ).not.toBeInTheDocument();
  });

  it("offers to try again when the Food List cannot be loaded", () => {
    const refetch = vi.fn();
    useFoods.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    open();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load your foods",
    );
  });
});

describe("FoodPickerSheet: reopening", () => {
  beforeEach(() => {
    useFoods.mockReset();
    useFoods.mockReturnValue({
      data: [apple, latte, toast],
      isPending: false,
      isError: false,
    });
  });

  it("starts fresh each time: empty search and no Food left open", async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <FoodPickerSheet open onPick={onPick} onClose={onClose} />,
    );
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search foods" }),
      "toast",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Sourdough toast/ }),
    );
    expect(screen.getByRole("button", { name: "Add 1½" })).toBeInTheDocument();

    rerender(
      <FoodPickerSheet open={false} onPick={onPick} onClose={onClose} />,
    );
    rerender(<FoodPickerSheet open onPick={onPick} onClose={onClose} />);

    expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveValue(
      "",
    );
    expect(
      screen.queryByRole("button", { name: "Add 1½" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
