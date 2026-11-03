import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useFoodTotals = vi.fn();
vi.mock("./queries", () => ({
  useFoodTotals: (range: unknown) => useFoodTotals(range),
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

import type { PeriodRange } from "./period";
import type { FoodTotal } from "./top-foods";
import { TopFoodsCard } from "./top-foods-card";

const RANGE: PeriodRange = { from: "2026-10-05", to: "2026-11-03", days: [] };
const food = (
  name: string,
  calories: number,
  entryCount: number,
  archived = false,
): FoodTotal => ({
  foodId: `id-${name}`,
  name,
  portion: "1 slice",
  archived,
  calories,
  entryCount,
});
const rows = [
  food("Rice", 260, 1),
  food("Toast", 660, 3),
  food("Pie", 300, 1, true),
];

const card = () => screen.getByRole("region", { name: "Top foods" });
const items = () =>
  within(screen.getByRole("list", { name: "Top foods" })).getAllByRole(
    "listitem",
  );

describe("TopFoodsCard", () => {
  beforeEach(() => {
    useFoodTotals.mockReset();
    useFoodTotals.mockReturnValue({
      data: rows,
      isPending: false,
      isError: false,
    });
  });

  it("asks for the Foods in the chosen range", () => {
    render(<TopFoodsCard range={RANGE} />);

    expect(useFoodTotals).toHaveBeenCalledWith(RANGE);
  });

  it("lists the Foods that account for the most calories, biggest first", () => {
    render(<TopFoodsCard range={RANGE} />);

    expect(items().map((li) => li.textContent)).toEqual([
      expect.stringContaining("Toast"),
      expect.stringContaining("Pie"),
      expect.stringContaining("Rice"),
    ]);
  });

  it("shows each Food's calories, share and how often it was logged", () => {
    render(<TopFoodsCard range={RANGE} />);

    // 660 + 300 + 260 = 1,220
    expect(items()[0]).toHaveTextContent("660 kcal");
    expect(items()[0]).toHaveTextContent("54%");
    expect(items()[0]).toHaveTextContent("3 times");
    expect(items()[2]).toHaveTextContent("1 time");
    expect(items()[2]).not.toHaveTextContent("1 times");
  });

  it("marks an Archived Food", () => {
    render(<TopFoodsCard range={RANGE} />);

    expect(items()[1]).toHaveTextContent("Archived");
    expect(items()[0]).not.toHaveTextContent("Archived");
  });

  it("opens a Food in the Food List, and an Archived one in Archived foods", () => {
    render(<TopFoodsCard range={RANGE} />);

    expect(within(items()[0]).getByRole("link")).toHaveAttribute(
      "href",
      "/foods?food=id-Toast",
    );
    expect(within(items()[1]).getByRole("link")).toHaveAttribute(
      "href",
      "/foods/archived",
    );
  });

  it("can rank by how often Foods were logged instead", async () => {
    useFoodTotals.mockReturnValue({
      data: [food("Apple", 80, 5), food("Toast", 660, 3)],
      isPending: false,
      isError: false,
    });
    render(<TopFoodsCard range={RANGE} />);
    expect(items()[0]).toHaveTextContent("Toast");

    await userEvent.click(screen.getByRole("button", { name: "Times logged" }));

    expect(
      screen.getByRole("button", { name: "Times logged" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Total calories" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(items()[0]).toHaveTextContent("Apple");
  });

  it("starts by total calories", () => {
    render(<TopFoodsCard range={RANGE} />);

    expect(
      screen.getByRole("button", { name: "Total calories" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("says so when nothing was logged in the range", () => {
    useFoodTotals.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    render(<TopFoodsCard range={RANGE} />);

    expect(card()).toHaveTextContent("Nothing logged in this period");
    expect(
      screen.queryByRole("list", { name: "Top foods" }),
    ).not.toBeInTheDocument();
  });

  it("shows a placeholder while loading", () => {
    useFoodTotals.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    render(<TopFoodsCard range={RANGE} />);

    expect(
      screen.queryByRole("list", { name: "Top foods" }),
    ).not.toBeInTheDocument();
    expect(card()).not.toHaveTextContent("Nothing logged");
  });

  it("offers to try again when it cannot load", () => {
    useFoodTotals.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    });
    render(<TopFoodsCard range={RANGE} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load your top foods",
    );
  });

  it("limits the list to ten", () => {
    useFoodTotals.mockReturnValue({
      data: Array.from({ length: 14 }, (_, i) => food(`Food ${i}`, 100 + i, 1)),
      isPending: false,
      isError: false,
    });
    render(<TopFoodsCard range={RANGE} />);

    expect(items()).toHaveLength(10);
  });
});
