import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const push = vi.hoisted(() => vi.fn());
const importHook = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null as Error | null,
}));
vi.mock("./queries", () => ({
  useImportFoods: () => importHook,
}));
const photo = vi.hoisted(() => ({
  resizePhoto: vi.fn(),
  readPhoto: vi.fn(),
}));
vi.mock("./photo", () => photo);
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
import { setPendingPhoto } from "./photo-handoff";

function stubClipboard(writeText: ((text: string) => Promise<void>) | null) {
  Object.defineProperty(navigator, "clipboard", {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

// jsdom has no layout, so it has no scrollIntoView either.
Element.prototype.scrollIntoView = vi.fn();

describe("ImportScreen", () => {
  beforeEach(() => {
    toast.mockReset();
    toast.error.mockReset();
    push.mockReset();
    sessionStorage.clear();
    foodsData.foods = [];
    importHook.mutate.mockReset();
    importHook.isPending = false;
    importHook.isError = false;
    importHook.error = null;
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

describe("ImportScreen: Save (AC-8, AC-9)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    push.mockReset();
    toast.mockReset();
    toast.error.mockReset();
    importHook.mutate.mockReset();
    importHook.isPending = false;
    importHook.isError = false;
    importHook.error = null;
    foodsData.foods = [];
  });

  it("offers to save the number of foods that will be saved", async () => {
    render(<ImportScreen />);

    await paste(CSV);

    expect(screen.getByRole("button", { name: "Save 1 food" })).toBeEnabled();
    await userEvent.type(
      within(rowCards()[1]).getByLabelText("Calories"),
      "180",
    );
    expect(screen.getByRole("button", { name: "Save 2 foods" })).toBeEnabled();
  });

  it("is off when nothing would be saved", async () => {
    render(<ImportScreen />);
    await paste("name,portion,calories\nMystery,1 serve,");

    expect(screen.getByRole("button", { name: "Save 0 foods" })).toBeDisabled();
  });

  it("sends the rows to be added and updated, not the ones left out", async () => {
    foodsData.foods = [
      {
        id: "food-1",
        name: "Rice",
        portion: "100 g",
        calories: 120,
        archivedAt: null,
      },
    ];
    render(<ImportScreen />);
    await paste(
      "name,portion,calories\nBanana,1 medium,105\nRice,100 g,130\nMystery,1 serve,",
    );
    await userEvent.click(
      within(rowCards()[1]).getByRole("radio", { name: "Update existing" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Save 2 foods" }));

    expect(importHook.mutate).toHaveBeenCalledWith(
      [
        { name: "Banana", portion: "1 medium", calories: 105 },
        { id: "food-1", name: "Rice", portion: "100 g", calories: 130 },
      ],
      expect.any(Object),
    );
  });

  it("on success clears the review, says what happened and returns to the Food List", async () => {
    render(<ImportScreen />);
    await paste(CSV);
    await userEvent.click(screen.getByRole("button", { name: "Save 1 food" }));
    const { onSuccess } = importHook.mutate.mock.calls[0][1];

    act(() => onSuccess({ added: 1, updated: 0 }));

    expect(toast).toHaveBeenCalledWith("Added 1");
    expect(push).toHaveBeenCalledWith("/foods");
    expect(sessionStorage.getItem("import-review")).toBeNull();
  });

  it("on failure keeps every row and edit so the User can retry", async () => {
    render(<ImportScreen />);
    await paste(CSV);
    await userEvent.type(
      within(rowCards()[1]).getByLabelText("Calories"),
      "180",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save 2 foods" }));
    const { onError } = importHook.mutate.mock.calls[0][1];

    act(() => onError(new Error("Nothing was saved; try again")));

    expect(toast.error).toHaveBeenCalledWith(
      "Nothing was saved; try again",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Retry" }),
      }),
    );
    expect(push).not.toHaveBeenCalled();
    expect(rowCards()).toHaveLength(3);
    expect(within(rowCards()[1]).getByLabelText("Calories")).toHaveValue("180");
  });

  it("shows the failure beside the rows, and Retry saves again", async () => {
    importHook.isError = true;
    importHook.error = new Error("Nothing was saved; check the rows");
    render(<ImportScreen />);
    await paste(CSV);

    expect(
      screen.getByText("Nothing was saved; check the rows"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save 1 food" }));
    expect(importHook.mutate).toHaveBeenCalledTimes(1);
  });

  it("shows Saving while it works, and cannot be pressed twice", async () => {
    render(<ImportScreen />);
    await paste(CSV);
    importHook.isPending = true;

    // Re-render with the pending flag.
    await userEvent.type(within(rowCards()[1]).getByLabelText("Calories"), "1");

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});

describe("ImportScreen: scanning notes (AC-1 to AC-6)", () => {
  const rows = [
    { name: "Toast", portion: "1 slice", calories: "110", kilojoules: "" },
    { name: "Mystery", portion: "1 serve", calories: "", kilojoules: "" },
  ];
  const jpeg = new File(["x"], "notes.jpg", { type: "image/jpeg" });
  const takePhoto = () =>
    userEvent.upload(screen.getByLabelText("Photo from camera"), jpeg);

  beforeEach(() => {
    sessionStorage.clear();
    foodsData.foods = [];
    photo.resizePhoto.mockReset();
    photo.readPhoto.mockReset();
    photo.resizePhoto.mockResolvedValue(
      new Blob(["jpeg"], { type: "image/jpeg" }),
    );
    photo.readPhoto.mockResolvedValue({ kind: "rows", rows });
  });

  it("opens the rear camera, or the gallery, from two buttons", () => {
    render(<ImportScreen />);

    const camera = screen.getByLabelText("Photo from camera");
    expect(camera).toHaveAttribute("accept", "image/*");
    expect(camera).toHaveAttribute("capture", "environment");
    expect(screen.getByLabelText("Photo from gallery")).not.toHaveAttribute(
      "capture",
    );
  });

  it("shrinks the photo, shows progress while it is read, then lists the foods for review", async () => {
    let finish: (value: unknown) => void = () => undefined;
    photo.readPhoto.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<ImportScreen />);

    await takePhoto();

    expect(photo.resizePhoto).toHaveBeenCalledWith(jpeg);
    expect(await screen.findByText("Reading your notes…")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /take a photo/i }),
    ).toBeDisabled();

    await act(async () => finish({ kind: "rows", rows }));

    expect(screen.queryByText("Reading your notes…")).not.toBeInTheDocument();
    expect(rowCards()).toHaveLength(2);
    expect(rowCards()[1]).toHaveTextContent("Add calories or kilojoules");
  });

  it("appends another photo's rows to the same import", async () => {
    render(<ImportScreen />);
    await takePhoto();
    await screen.findByRole("list", { name: "Rows to review" });
    photo.readPhoto.mockResolvedValue({
      kind: "rows",
      rows: [
        { name: "Rice", portion: "100 g", calories: "130", kilojoules: "" },
      ],
    });

    await userEvent.upload(screen.getByLabelText("Photo from camera"), jpeg);

    await waitFor(() => expect(rowCards()).toHaveLength(3));
    expect(within(rowCards()[2]).getByLabelText("Name")).toHaveValue("Rice");
    expect(
      screen.getByRole("heading", { name: "Add another photo" }),
    ).toBeInTheDocument();
  });

  it("says when no foods were found and lets the User retake the photo", async () => {
    photo.readPhoto.mockResolvedValue({ kind: "empty" });
    render(<ImportScreen />);

    await takePhoto();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't find any foods in that photo",
    );
    expect(screen.getByRole("button", { name: /take a photo/i })).toBeEnabled();
  });

  it("offers a way out to an AI app when the reader is unavailable (AC-6)", async () => {
    photo.readPhoto.mockResolvedValue({ kind: "unavailable" });
    render(<ImportScreen />);
    await takePhoto();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("isn't available right now");
    await userEvent.click(
      within(alert).getByRole("button", { name: "Use an AI app instead" }),
    );

    expect(
      screen.queryByText(/isn't available right now/),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("prompt")).toBeInTheDocument();
  });

  it("brings the prompt back even when rows are already being reviewed", async () => {
    render(<ImportScreen />);
    await takePhoto();
    await screen.findByRole("list", { name: "Rows to review" });
    expect(screen.queryByTestId("prompt")).not.toBeInTheDocument();
    photo.readPhoto.mockResolvedValue({ kind: "unavailable" });

    await userEvent.upload(screen.getByLabelText("Photo from camera"), jpeg);
    await userEvent.click(
      await screen.findByRole("button", { name: "Use an AI app instead" }),
    );

    expect(screen.getByTestId("prompt")).toBeInTheDocument();
    expect(rowCards()).toHaveLength(2);
  });

  it("says something went wrong when the photo cannot be read at all", async () => {
    photo.resizePhoto.mockRejectedValue(new Error("bad"));
    render(<ImportScreen />);

    await takePhoto();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong reading that photo",
    );
    expect(photo.readPhoto).not.toHaveBeenCalled();
  });

  it("starts reading a photo chosen in the Add food sheet", async () => {
    setPendingPhoto(jpeg);

    render(<ImportScreen />);

    await waitFor(() => expect(photo.resizePhoto).toHaveBeenCalledWith(jpeg));
    await waitFor(() => expect(rowCards()).toHaveLength(2));
  });
});
