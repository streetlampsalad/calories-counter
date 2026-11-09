import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Food } from "@/features/foods/types";

const useFoods = vi.fn();
vi.mock("@/features/foods/queries", () => ({ useFoods: () => useFoods() }));
const useFoodUsage = vi.fn();
vi.mock("./queries", () => ({
  useFoodUsage: (since: string, until: string, enabled: boolean) =>
    useFoodUsage(since, until, enabled),
}));
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

const mealTimesOn = vi.fn();
vi.mock("@/features/toggles/queries", () => ({
  useToggle: () => mealTimesOn(),
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

function open(day = "2026-11-03") {
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(
    <FoodPickerSheet
      today="2026-11-03"
      day={day}
      open
      onPick={onPick}
      onClose={onClose}
    />,
  );
  return { onPick, onClose };
}

describe("FoodPickerSheet", () => {
  beforeEach(() => {
    useFoods.mockReset();
    useFoodUsage.mockReset();
    mealTimesOn.mockReset();
    mealTimesOn.mockReturnValue(false);
    vi.useRealTimers();
    useFoodUsage.mockReturnValue({ data: [] });
    useFoods.mockReturnValue({
      data: [apple, latte, toast],
      isPending: false,
      isError: false,
    });
  });

  it("opens without focus in the search box, so the keyboard stays down", async () => {
    open();

    // Focus lands on the sheet's title, which screen readers read, and not on anything typeable.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Add to your day" }),
      ).toHaveFocus(),
    );
    expect(
      screen.getByRole("searchbox", { name: "Search foods" }),
    ).not.toHaveFocus();
  });

  it("still lets the search box be focused by tapping it", async () => {
    open();

    await userEvent.click(
      screen.getByRole("searchbox", { name: "Search foods" }),
    );

    expect(
      screen.getByRole("searchbox", { name: "Search foods" }),
    ).toHaveFocus();
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

    expect(onPick).toHaveBeenCalledWith(toast, 1.5, null);
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
    useFoodUsage.mockReset();
    useFoodUsage.mockReturnValue({ data: [] });
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
      <FoodPickerSheet
        today="2026-11-03"
        day="2026-11-03"
        open
        onPick={onPick}
        onClose={onClose}
      />,
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
      <FoodPickerSheet
        today="2026-11-03"
        day="2026-11-03"
        open={false}
        onPick={onPick}
        onClose={onClose}
      />,
    );
    rerender(
      <FoodPickerSheet
        today="2026-11-03"
        day="2026-11-03"
        open
        onPick={onPick}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveValue(
      "",
    );
    expect(
      screen.queryByRole("button", { name: "Add 1½" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("FoodPickerSheet: most-logged first, and Recent", () => {
  const rice = food("Rice", "100 g", 130);
  const usageOf = (
    foodId: string,
    entryCount: number,
    lastLoggedAt: string,
  ) => ({
    foodId,
    entryCount,
    lastLoggedAt,
  });

  beforeEach(() => {
    useFoods.mockReset();
    useFoodUsage.mockReset();
    useFoods.mockReturnValue({
      data: [apple, latte, rice, toast],
      isPending: false,
      isError: false,
    });
  });

  const names = () =>
    within(screen.getByRole("list", { name: "Your foods" }))
      .getAllByRole("listitem")
      .map((row) => row.textContent ?? "");

  it("looks back 90 days, only while the picker is open", () => {
    useFoodUsage.mockReturnValue({ data: [] });
    open();

    expect(useFoodUsage).toHaveBeenCalledWith("2026-08-05", "2026-11-03", true);
  });

  it("orders the list by how often each Food was logged, then alphabetically", () => {
    useFoodUsage.mockReturnValue({
      data: [
        usageOf("Rice", 9, "2026-11-01T08:00:00Z"),
        usageOf("Sourdough toast", 4, "2026-11-02T08:00:00Z"),
      ],
    });
    open();

    const order = names();
    expect(order[0]).toContain("Rice");
    expect(order[1]).toContain("Sourdough toast");
    expect(order[2]).toContain("Apple");
    expect(order[3]).toContain("Café latte");
  });

  it("keeps that order while searching", async () => {
    const tea = food("Tea");
    const tomato = food("Tomato");
    const toastPlain = food("Toast");
    useFoods.mockReturnValue({
      data: [tea, toastPlain, tomato],
      isPending: false,
      isError: false,
    });
    useFoodUsage.mockReturnValue({
      data: [
        usageOf("Tomato", 9, "2026-11-01T08:00:00Z"),
        usageOf("Toast", 3, "2026-11-02T08:00:00Z"),
      ],
    });
    open();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search foods" }),
      "t",
    );

    expect(names().map((n) => n.split("1 slice")[0])).toEqual([
      expect.stringContaining("Tomato"),
      expect.stringContaining("Toast"),
      expect.stringContaining("Tea"),
    ]);
  });

  it("shows a Recent row, newest first, as large tap targets", () => {
    useFoodUsage.mockReturnValue({
      data: [
        usageOf("Apple", 1, "2026-11-01T08:00:00Z"),
        usageOf("Rice", 1, "2026-11-03T08:00:00Z"),
        usageOf("Sourdough toast", 1, "2026-11-02T08:00:00Z"),
      ],
    });
    open();

    const recent = screen.getByRole("group", { name: "Recent" });
    expect(
      within(recent)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Rice", "Sourdough toast", "Apple"]);
  });

  it("logs from a Recent Food in two taps", async () => {
    useFoodUsage.mockReturnValue({
      data: [usageOf("Rice", 1, "2026-11-03T08:00:00Z")],
    });
    const { onPick, onClose } = open();

    await userEvent.click(
      within(screen.getByRole("group", { name: "Recent" })).getByRole(
        "button",
        { name: "Rice" },
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Add 2" }));

    expect(onPick).toHaveBeenCalledWith(rice, 2, null);
    expect(onClose).toHaveBeenCalled();
  });

  it("hides Recent while searching, and when nothing has been logged", async () => {
    useFoodUsage.mockReturnValue({
      data: [usageOf("Rice", 1, "2026-11-03T08:00:00Z")],
    });
    const { unmount } = render(
      <FoodPickerSheet
        today="2026-11-03"
        day="2026-11-03"
        open
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("group", { name: "Recent" })).toBeInTheDocument();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search foods" }),
      "r",
    );
    expect(
      screen.queryByRole("group", { name: "Recent" }),
    ).not.toBeInTheDocument();
    unmount();

    useFoodUsage.mockReturnValue({ data: [] });
    open();
    expect(
      screen.queryByRole("group", { name: "Recent" }),
    ).not.toBeInTheDocument();
  });

  it("works while usage is still loading", () => {
    useFoodUsage.mockReturnValue({ data: undefined });
    open();

    expect(names()).toHaveLength(4);
    expect(
      screen.queryByRole("group", { name: "Recent" }),
    ).not.toBeInTheDocument();
  });

  describe("Meal time chips (spec 174)", () => {
    const chips = () =>
      screen.getAllByRole("button", {
        name: /^(Breakfast|Lunch|Dinner|Snack)$/,
      });

    async function pickToast(onPick: ReturnType<typeof vi.fn>) {
      await userEvent.click(
        screen.getByRole("button", { name: /Sourdough toast/ }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Add 1" }));
      return onPick;
    }

    beforeEach(() => {
      useFoods.mockReturnValue({
        data: [apple, latte, toast],
        isPending: false,
        isError: false,
      });
      useFoodUsage.mockReturnValue({ data: [] });
      mealTimesOn.mockReturnValue(true);
      vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 3, 8, 0) });
    });

    it("shows four chips of at least 44 px, none chosen on another Day (US1.1, US1.7)", () => {
      open("2026-11-04");

      expect(chips().map((chip) => chip.textContent)).toEqual([
        "Breakfast",
        "Lunch",
        "Dinner",
        "Snack",
      ]);
      for (const chip of chips()) {
        expect(chip).toHaveAttribute("aria-pressed", "false");
        expect(chip).toHaveClass("min-h-11");
      }
    });

    it("pre-chooses the chip for the time of day on today (US1.2)", () => {
      open();

      expect(screen.getByRole("button", { name: "Breakfast" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    it("chooses one chip at a time, and tapping the chosen chip clears it (US1.3)", async () => {
      open();

      await userEvent.click(screen.getByRole("button", { name: "Dinner" }));
      expect(screen.getByRole("button", { name: "Dinner" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "Breakfast" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );

      await userEvent.click(screen.getByRole("button", { name: "Dinner" }));
      for (const chip of chips())
        expect(chip).toHaveAttribute("aria-pressed", "false");
    });

    it("passes the chosen Meal time with the pick (US1.4)", async () => {
      const { onPick } = open();
      await userEvent.click(screen.getByRole("button", { name: "Snack" }));

      await pickToast(onPick);

      expect(onPick).toHaveBeenCalledWith(toast, 1, "snack");
    });

    it("passes none when no chip is chosen (US1.5)", async () => {
      const { onPick } = open();
      await userEvent.click(screen.getByRole("button", { name: "Breakfast" }));

      await pickToast(onPick);

      expect(onPick).toHaveBeenCalledWith(toast, 1, null);
    });

    it("shows no chips and passes no Meal time when the Toggle is off (US1.6)", async () => {
      mealTimesOn.mockReturnValue(false);
      const { onPick } = open();

      expect(
        screen.queryByRole("button", { name: "Breakfast" }),
      ).not.toBeInTheDocument();
      await pickToast(onPick);
      expect(onPick).toHaveBeenCalledWith(toast, 1, null);
    });
  });
});
