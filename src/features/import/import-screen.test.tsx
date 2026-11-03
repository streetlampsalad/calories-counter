import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const push = vi.hoisted(() => vi.fn());
const foodsData = vi.hoisted(() => ({ foods: [] as unknown[] }));
vi.mock("@/features/foods/queries", () => ({
  useFoods: () => ({ data: foodsData.foods }),
}));
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

import { AI_PROMPT } from "./ai-prompt";
import { ImportScreen } from "./import-screen";

function stubClipboard(writeText: ((text: string) => Promise<void>) | null) {
  Object.defineProperty(navigator, "clipboard", {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

describe("ImportScreen", () => {
  beforeEach(() => {
    toast.mockReset();
    toast.error.mockReset();
    push.mockReset();
    sessionStorage.clear();
    foodsData.foods = [];
    window.getSelection()?.removeAllRanges();
  });

  it("shows the three steps", () => {
    render(<ImportScreen />);

    expect(
      screen.getByRole("heading", { name: "Import from notes", level: 1 }),
    ).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent("Copy the prompt");
    expect(steps[1]).toHaveTextContent("Ask any AI");
    expect(steps[1]).toHaveTextContent("photo");
    expect(steps[2]).toHaveTextContent("Upload or paste");
  });

  it("shows the full prompt text", () => {
    render(<ImportScreen />);

    expect(screen.getByTestId("prompt").textContent).toBe(AI_PROMPT);
  });

  it("copies the exact prompt and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<ImportScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Copy prompt" }));

    expect(writeText).toHaveBeenCalledWith(AI_PROMPT);
    expect(toast).toHaveBeenCalledWith("Prompt copied");
  });

  it("selects the prompt for copying by hand when the clipboard is refused", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<ImportScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Copy prompt" }));

    expect(window.getSelection()?.toString()).toBe(AI_PROMPT);
    expect(toast).not.toHaveBeenCalledWith("Prompt copied");
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("copy it by hand"),
    );
  });

  it("selects the prompt when there is no clipboard at all", async () => {
    stubClipboard(null);
    render(<ImportScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Copy prompt" }));

    expect(window.getSelection()?.toString()).toBe(AI_PROMPT);
  });

  it("leads back to the Food List", () => {
    render(<ImportScreen />);

    expect(screen.getByRole("link", { name: /Foods/ })).toHaveAttribute(
      "href",
      "/foods",
    );
  });
});

const CSV = [
  "name,portion,calories",
  "Banana,1 medium,105",
  "Mystery,1 serve,",
  "Chocolate,1 bar,",
].join("\n");

async function paste(text: string) {
  await userEvent.click(screen.getByLabelText("Paste the result"));
  await userEvent.paste(text);
  await userEvent.click(
    screen.getByRole("button", { name: "Review pasted result" }),
  );
}
const rowCards = () =>
  within(screen.getByRole("list", { name: "Rows to review" })).getAllByRole(
    "listitem",
  );

describe("ImportScreen: pasting a result", () => {
  beforeEach(() => {
    sessionStorage.clear();
    push.mockReset();
  });

  it("shows every row for review, valid ones on and flagged ones off", async () => {
    render(<ImportScreen />);

    await paste(CSV);

    expect(rowCards()).toHaveLength(3);
    expect(within(rowCards()[0]).getByRole("switch")).toBeChecked();
    expect(within(rowCards()[1]).getByRole("switch")).not.toBeChecked();
    expect(within(rowCards()[1]).getByRole("switch")).toBeDisabled();
    expect(rowCards()[1]).toHaveTextContent("Add calories or kilojoules");
    expect(
      screen.getByText(/1 of 3 rows will be saved, 2 need fixing/),
    ).toBeInTheDocument();
  });

  it("switches a flagged row on once it is fixed", async () => {
    render(<ImportScreen />);
    await paste(CSV);

    await userEvent.type(
      within(rowCards()[1]).getByLabelText("Calories"),
      "180",
    );

    expect(within(rowCards()[1]).getByRole("switch")).toBeChecked();
    expect(within(rowCards()[1]).getByRole("switch")).toBeEnabled();
    expect(rowCards()[1]).not.toHaveTextContent("Add calories or kilojoules");
    expect(
      screen.getByText(/2 of 3 rows will be saved, 1 needs fixing/),
    ).toBeInTheDocument();
  });

  it("lets a valid row be switched off and on", async () => {
    render(<ImportScreen />);
    await paste(CSV);
    const toggle = within(rowCards()[0]).getByRole("switch");

    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(toggle).toBeChecked();
  });

  it("shows the kilojoules a row was converted from", async () => {
    render(<ImportScreen />);

    await paste("name,portion,kilojoules\nChocolate,1 bar,1000");

    expect(rowCards()[0]).toHaveTextContent("(from 1,000 kJ)");
    expect(within(rowCards()[0]).getByLabelText("Calories")).toHaveValue("239");
  });

  it("explains text it cannot read, and stays on the source", async () => {
    render(<ImportScreen />);

    await paste("Remember to buy milk");

    expect(screen.getByRole("alert")).toHaveTextContent("CSV or JSON");
    expect(
      screen.queryByRole("list", { name: "Rows to review" }),
    ).not.toBeInTheDocument();
  });

  it("rejects a file that is not CSV or JSON, and one that is too big", async () => {
    render(<ImportScreen />);
    const input = screen.getByLabelText("CSV or JSON file");

    await userEvent.upload(
      input,
      new File(["x"], "notes.pdf", { type: "application/pdf" }),
      { applyAccept: false },
    );
    expect(screen.getByRole("alert")).toHaveTextContent("CSV or JSON");

    const big = new File(["x"], "big.csv", { type: "text/csv" });
    Object.defineProperty(big, "size", { value: 2 * 1024 * 1024 });
    await userEvent.upload(input, big);
    expect(screen.getByRole("alert")).toHaveTextContent("1 MB");
  });

  it("reads a chosen CSV file", async () => {
    render(<ImportScreen />);

    await userEvent.upload(
      screen.getByLabelText("CSV or JSON file"),
      new File([CSV], "foods.csv", { type: "text/csv" }),
    );

    expect(
      await screen.findByRole("list", { name: "Rows to review" }),
    ).toBeInTheDocument();
    expect(rowCards()).toHaveLength(3);
  });

  it("keeps the rows if the page reloads", async () => {
    const first = render(<ImportScreen />);
    await paste(CSV);
    first.unmount();

    render(<ImportScreen />);

    expect(rowCards()).toHaveLength(3);
  });
});

describe("ImportScreen: leaving with unsaved rows (AC-11)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    push.mockReset();
  });

  it("leaves straight away when there is nothing to lose", async () => {
    render(<ImportScreen />);

    await userEvent.click(screen.getByRole("link", { name: /Foods/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks before leaving, and stays if the User keeps editing", async () => {
    render(<ImportScreen />);
    await paste(CSV);

    await userEvent.click(screen.getByRole("link", { name: /Foods/ }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("3 rows haven't been saved");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Keep editing" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(rowCards()).toHaveLength(3);
    expect(push).not.toHaveBeenCalled();
  });

  it("discards the rows and goes on when the User confirms", async () => {
    render(<ImportScreen />);
    await paste(CSV);
    await userEvent.click(screen.getByRole("link", { name: /Foods/ }));

    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Discard",
      }),
    );

    expect(push).toHaveBeenCalledWith("/foods");
    expect(sessionStorage.getItem("import-review")).toBeNull();
  });

  it("asks before starting over, and goes back to the source when confirmed", async () => {
    render(<ImportScreen />);
    await paste(CSV);

    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Discard",
      }),
    );

    expect(screen.getByLabelText("Paste the result")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("ImportScreen: duplicates (AC-7)", () => {
  const banana = {
    id: "food-1",
    name: "Banana",
    portion: "1 medium",
    calories: 90,
    archivedAt: null,
  };

  beforeEach(() => {
    sessionStorage.clear();
    push.mockReset();
    foodsData.foods = [banana];
  });

  it("flags a row already in the Food List and skips it by default", async () => {
    render(<ImportScreen />);

    await paste("name,portion,calories\nBanana,1 medium,105\nRice,100 g,130");

    expect(rowCards()[0]).toHaveTextContent("Already in your list (90 kcal)");
    expect(
      within(rowCards()[0]).getByRole("radio", { name: "Skip" }),
    ).toBeChecked();
    expect(rowCards()[0]).toHaveTextContent("Skipped, already in your list");
    expect(rowCards()[1]).not.toHaveTextContent("Already in your list");
    expect(rowCards()[1]).toHaveTextContent("Will be added");
    expect(
      screen.getByText(/1 of 2 rows will be saved, 1 already in your list/),
    ).toBeInTheDocument();
  });

  it("updates the existing Food when asked, and says past days follow", async () => {
    render(<ImportScreen />);
    await paste("name,portion,calories\nBanana,1 medium,105");

    await userEvent.click(
      within(rowCards()[0]).getByRole("radio", { name: "Update existing" }),
    );

    expect(rowCards()[0]).toHaveTextContent("Will update your existing food");
    expect(rowCards()[0]).toHaveTextContent(
      "Past days will use the new calories",
    );
    expect(screen.getByText(/1 of 1 row will be saved/)).toBeInTheDocument();
  });

  it("ignores case and spacing, and ignores Archived Foods", async () => {
    foodsData.foods = [
      banana,
      {
        ...banana,
        id: "food-2",
        name: "Rice",
        portion: "100 g",
        archivedAt: "2026-01-01",
      },
    ];
    render(<ImportScreen />);

    await paste(
      "name,portion,calories\n BANANA ,1  Medium,105\nRice,100 g,130",
    );

    expect(rowCards()[0]).toHaveTextContent("Already in your list");
    expect(rowCards()[1]).not.toHaveTextContent("Already in your list");
  });

  it("merges identical rows within the import into one", async () => {
    foodsData.foods = [];
    render(<ImportScreen />);

    await paste(
      "name,portion,calories\nBanana,1 medium,105\nbanana,1 medium,105",
    );

    expect(rowCards()).toHaveLength(1);
    expect(rowCards()[0]).toHaveTextContent("Merged with 1 identical row");
  });

  it("keeps the first of two rows that disagree and says what the other said", async () => {
    foodsData.foods = [];
    render(<ImportScreen />);

    await paste(
      "name,portion,calories\nBanana,1 medium,105\nBanana,1 medium,110",
    );

    expect(rowCards()).toHaveLength(1);
    expect(within(rowCards()[0]).getByLabelText("Calories")).toHaveValue("105");
    expect(rowCards()[0]).toHaveTextContent("Another row said 110 kcal");
  });
});
