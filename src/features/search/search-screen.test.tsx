import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
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

const foodsData = vi.hoisted(() => ({ foods: [] as unknown[] }));
const addFood = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/features/foods/queries", () => ({
  useFoods: () => ({ data: foodsData.foods }),
  useAddFood: () => addFood,
}));

const reference = vi.hoisted(() => ({
  state: { data: undefined as unknown, isPending: false, isError: false },
  refetch: vi.fn(),
  seen: [] as string[],
}));
vi.mock("./queries", () => ({
  MIN_QUERY: 2,
  useReferenceSearch: (q: string) => {
    reference.seen.push(q);
    return { ...reference.state, refetch: reference.refetch };
  },
}));

import { SearchScreen } from "./search-screen";

const banana = {
  key: "reference:1",
  name: "Banana, cavendish, raw",
  per100: { calories: 93, unit: "g" as const },
  sourceLabel: "From the Australian Food Composition Database",
};
const food = (over = {}) => ({
  id: "food-1",
  name: "Banana",
  portion: "1 medium",
  calories: 105,
  archivedAt: null,
  ...over,
});

async function search(text: string) {
  await userEvent.clear(screen.getByLabelText("Search for a food"));
  await userEvent.type(screen.getByLabelText("Search for a food"), text);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
}

describe("SearchScreen", () => {
  beforeEach(() => {
    push.mockReset();
    toast.mockReset();
    toast.error.mockReset();
    addFood.mutate.mockReset();
    foodsData.foods = [];
    reference.seen = [];
    reference.state = { data: [banana], isPending: false, isError: false };
  });

  it("searches only when submitted, never on each keystroke (AC-1)", async () => {
    render(<SearchScreen />);

    await userEvent.type(screen.getByLabelText("Search for a food"), "banana");

    expect(reference.seen.every((q) => q === "")).toBe(true);
    expect(
      screen.queryByRole("heading", { name: "Australian foods" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(reference.seen.at(-1)).toBe("banana");
    expect(
      screen.getByRole("heading", { name: "Australian foods" }),
    ).toBeInTheDocument();
  });

  it("submits with the keyboard's search key too", async () => {
    render(<SearchScreen />);

    await userEvent.type(
      screen.getByLabelText("Search for a food"),
      "banana{Enter}",
    );

    expect(reference.seen.at(-1)).toBe("banana");
  });

  it("asks for at least two characters", async () => {
    render(<SearchScreen />);

    await search("b");

    expect(screen.getByText("Type at least 2 characters.")).toBeInTheDocument();
    expect(reference.seen.at(-1)).toBe("");
  });

  it("lists the Australian foods with their energy per 100 g", async () => {
    render(<SearchScreen />);

    await search("banana");

    const list = screen.getByRole("list", { name: "Australian foods" });
    expect(
      within(list).getByText("Banana, cavendish, raw"),
    ).toBeInTheDocument();
    expect(within(list).getByText("93 kcal per 100 g")).toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    reference.state = { data: [], isPending: false, isError: false };
    render(<SearchScreen />);

    await search("zzzz");

    expect(
      screen.getByText("No Australian foods match “zzzz”."),
    ).toBeInTheDocument();
  });

  it("shows a placeholder while searching, and offers to retry a failure", async () => {
    reference.state = { data: undefined, isPending: true, isError: false };
    const view = render(<SearchScreen />);
    await search("banana");
    expect(
      screen.queryByRole("list", { name: "Australian foods" }),
    ).not.toBeInTheDocument();
    view.unmount();

    reference.state = { data: undefined, isPending: false, isError: true };
    render(<SearchScreen />);
    await search("banana");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reference.refetch).toHaveBeenCalled();
  });

  it("puts Your foods first, linking to the Food instead of making a duplicate (AC-9)", async () => {
    foodsData.foods = [
      food(),
      food({ id: "food-2", name: "Rice", portion: "100 g", calories: 130 }),
    ];
    render(<SearchScreen />);

    await search("banana");

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Your foods", "Australian foods"]);
    const link = within(
      screen.getByRole("list", { name: "Your foods" }),
    ).getByRole("link");
    expect(link).toHaveAttribute("href", "/foods?food=food-1");
    expect(link).toHaveTextContent("Banana");
    expect(link).toHaveTextContent("1 medium · 105 kcal");
    expect(screen.queryByText("Rice")).not.toBeInTheDocument();
  });

  it("has no Your foods section when nothing of theirs matches", async () => {
    foodsData.foods = [food({ name: "Rice" })];
    render(<SearchScreen />);

    await search("banana");

    expect(
      screen.queryByRole("heading", { name: "Your foods" }),
    ).not.toBeInTheDocument();
  });

  it("opens the Food form with the picked values, portion and source (AC-4)", async () => {
    render(<SearchScreen />);
    await search("banana");

    await userEvent.click(
      screen.getByRole("button", { name: /Banana, cavendish, raw/ }),
    );

    expect(await screen.findByLabelText("Name")).toHaveValue(
      "Banana, cavendish, raw",
    );
    expect(screen.getByLabelText("Portion")).toHaveValue("100 g");
    expect(screen.getByLabelText("Calories")).toHaveValue("93");
    expect(
      screen.getByText("From the Australian Food Composition Database"),
    ).toBeInTheDocument();
  });

  it("saves the Food as edited, says so, and stays on the results", async () => {
    render(<SearchScreen />);
    await search("banana");
    await userEvent.click(
      screen.getByRole("button", { name: /Banana, cavendish, raw/ }),
    );
    await userEvent.clear(await screen.findByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Banana");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(addFood.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Banana",
        portion: "100 g",
        calories: 93,
        archivedAt: null,
      }),
      expect.any(Object),
    );
    const { onSuccess } = addFood.mutate.mock.calls[0][1];
    onSuccess();
    expect(toast).toHaveBeenCalledWith("Added Banana");
    await waitFor(() =>
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("list", { name: "Australian foods" }),
    ).toBeInTheDocument();
  });

  it("does not make a duplicate of a Food already in the list", async () => {
    foodsData.foods = [
      food({ name: "Banana, cavendish, raw", portion: "100 g", calories: 90 }),
    ];
    render(<SearchScreen />);
    await search("banana");
    await userEvent.click(
      screen.getByRole("button", { name: /Banana, cavendish, raw/ }),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(addFood.mutate).not.toHaveBeenCalled();
    expect(
      screen.getByText(/You already have Banana, cavendish, raw/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Edit Banana, cavendish, raw/ }),
    );
    expect(push).toHaveBeenCalledWith("/foods?food=food-1");
  });
});
