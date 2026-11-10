import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
let requests: { id: string; stage: string; withdrawnAt: string | null }[] = [];
vi.mock("./queries", () => ({
  useGiveFeedback: () => ({ mutate, isPending: false }),
  useMyFeatureRequests: () => ({ data: requests }),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

import { FeedbackSheet } from "./feedback-sheet";

async function open() {
  render(<FeedbackSheet id="r1" goal="Track water as well as food" />);
  await userEvent.click(screen.getByRole("button", { name: "Give feedback" }));
  return screen.findByRole("dialog", { name: "What should change?" });
}

const set = (n: number) => screen.getByRole("group", { name: `Set ${n}` });
const textOf = (n: number) =>
  within(set(n)).getByRole("textbox", { name: `Set ${n}` });
const addSet = () =>
  userEvent.click(screen.getByRole("button", { name: "Add another set" }));
const send = () =>
  userEvent.click(screen.getByRole("button", { name: "Send feedback" }));

describe("FeedbackSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requests = [{ id: "r1", stage: "ready_to_try", withdrawnAt: null }];
  });

  it("opens with one Enhancement set, Add another set and no remove button (US1.1)", async () => {
    const sheet = await open();
    expect(sheet).toHaveTextContent(/posted publicly on GitHub/);

    expect(screen.getAllByRole("group", { name: /^Set \d$/ })).toHaveLength(1);
    expect(textOf(1)).toHaveValue("");
    expect(
      within(set(1)).getByRole("radio", { name: "Enhancement" }),
    ).toBeChecked();
    expect(
      within(set(1)).getByRole("radio", { name: "Bug" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Add another set" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^Remove set/ }),
    ).not.toBeInTheDocument();
  });

  it("gives a category to that set only (US1.2)", async () => {
    await open();
    await addSet();

    await userEvent.click(within(set(2)).getByRole("radio", { name: "Bug" }));
    expect(within(set(2)).getByRole("radio", { name: "Bug" })).toBeChecked();
    expect(
      within(set(1)).getByRole("radio", { name: "Enhancement" }),
    ).toBeChecked();

    await userEvent.click(
      within(set(2)).getByRole("radio", { name: "Enhancement" }),
    );
    expect(
      within(set(2)).getByRole("radio", { name: "Enhancement" }),
    ).toBeChecked();
  });

  it("adds empty Enhancement sets up to 5, then offers no more (US1.3)", async () => {
    await open();
    for (let n = 2; n <= 5; n++) {
      await addSet();
      expect(textOf(n)).toHaveValue("");
      expect(
        within(set(n)).getByRole("radio", { name: "Enhancement" }),
      ).toBeChecked();
    }

    expect(screen.getAllByRole("group", { name: /^Set \d$/ })).toHaveLength(5);
    expect(
      screen.queryByRole("button", { name: "Add another set" }),
    ).not.toBeInTheDocument();
  });

  it("removes one set and keeps the others' text and category (US1.4)", async () => {
    await open();
    await userEvent.type(textOf(1), "The glass button does nothing");
    await userEvent.click(within(set(1)).getByRole("radio", { name: "Bug" }));
    await addSet();
    await userEvent.type(textOf(2), "Something I changed my mind on");
    await addSet();
    await userEvent.type(textOf(3), "Let me add half a glass");

    await userEvent.click(screen.getByRole("button", { name: "Remove set 2" }));

    expect(screen.getAllByRole("group", { name: /^Set \d$/ })).toHaveLength(2);
    expect(textOf(1)).toHaveValue("The glass button does nothing");
    expect(within(set(1)).getByRole("radio", { name: "Bug" })).toBeChecked();
    expect(textOf(2)).toHaveValue("Let me add half a glass");
    expect(
      within(set(2)).getByRole("radio", { name: "Enhancement" }),
    ).toBeChecked();
  });

  it("sends nothing while a set is under 10 characters, and says which (US1.5)", async () => {
    await open();
    await userEvent.type(textOf(1), "The glass button does nothing");
    await addSet();
    await userEvent.type(textOf(2), "more");
    await send();

    expect(mutate).not.toHaveBeenCalled();
    const message = screen.getByText(
      "Set 2: say what should change, in at least 10 characters.",
    );
    expect(message).toBeVisible();
    expect(textOf(2)).toHaveAccessibleDescription(message.textContent ?? "");
    expect(textOf(1)).not.toHaveAttribute("aria-invalid");
  });

  it("sends every set in order with its category (US1.6)", async () => {
    await open();
    await userEvent.type(textOf(1), "The glass button does nothing");
    await userEvent.click(within(set(1)).getByRole("radio", { name: "Bug" }));
    await addSet();
    await userEvent.type(textOf(2), "Let me add half a glass");
    await addSet();
    await userEvent.type(textOf(3), "Remember my usual glass size");
    await send();

    expect(mutate).toHaveBeenCalledWith(
      {
        id: "r1",
        sets: [
          { category: "bug", text: "The glass button does nothing" },
          { category: "enhancement", text: "Let me add half a glass" },
          { category: "enhancement", text: "Remember my usual glass size" },
        ],
      },
      expect.any(Object),
    );
  });

  it("says 2 at a time, and cannot be sent, while 2 other requests are being worked on (US1.7)", async () => {
    requests = [
      { id: "r1", stage: "ready_to_try", withdrawnAt: null },
      { id: "r2", stage: "building", withdrawnAt: null },
      { id: "r3", stage: "submitted", withdrawnAt: null },
    ];
    const sheet = await open();

    expect(sheet).toHaveTextContent(/2 requests at a time/);
    expect(
      screen.queryByRole("button", { name: "Send feedback" }),
    ).not.toBeInTheDocument();
  });

  it("keeps every set and says so when they couldn't be sent (US1.9)", async () => {
    mutate.mockImplementation((_input, options) =>
      options.onError(
        new Error(
          "Couldn't send your feedback. Check your connection and try again.",
        ),
      ),
    );
    await open();
    await userEvent.type(textOf(1), "The glass button does nothing");
    await userEvent.click(within(set(1)).getByRole("radio", { name: "Bug" }));
    await addSet();
    await userEvent.type(textOf(2), "Let me add half a glass");
    await send();

    expect(toastError).toHaveBeenCalledWith(
      "Couldn't send your feedback. Check your connection and try again.",
    );
    expect(textOf(1)).toHaveValue("The glass button does nothing");
    expect(within(set(1)).getByRole("radio", { name: "Bug" })).toBeChecked();
    expect(textOf(2)).toHaveValue("Let me add half a glass");
  });

  it("changes nothing when cancelled", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mutate).not.toHaveBeenCalled();
  });
});
