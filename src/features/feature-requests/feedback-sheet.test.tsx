import { render, screen } from "@testing-library/react";
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

describe("FeedbackSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requests = [{ id: "r1", stage: "ready_to_try", withdrawnAt: null }];
  });

  it("says the feedback is posted publicly, and sends it (US1.2, US1.3)", async () => {
    const sheet = await open();
    expect(sheet).toHaveTextContent(/posted publicly on GitHub/);

    await userEvent.type(
      screen.getByRole("textbox", { name: "What should change?" }),
      "Let me add half a glass",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Send feedback" }),
    );

    expect(mutate).toHaveBeenCalledWith(
      { id: "r1", feedback: "Let me add half a glass" },
      expect.any(Object),
    );
  });

  it("sends nothing under 10 characters, and says what it needs (US1.2)", async () => {
    await open();
    await userEvent.type(
      screen.getByRole("textbox", { name: "What should change?" }),
      "more",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Send feedback" }),
    );

    expect(mutate).not.toHaveBeenCalled();
    expect(
      screen.getByText("Say what should change, in at least 10 characters."),
    ).toBeVisible();
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

  it("keeps the feedback and says so when it couldn't be sent", async () => {
    mutate.mockImplementation((_input, options) =>
      options.onError(
        new Error(
          "Couldn't send your feedback. Check your connection and try again.",
        ),
      ),
    );
    await open();
    const field = screen.getByRole("textbox", { name: "What should change?" });
    await userEvent.type(field, "Let me add half a glass");
    await userEvent.click(
      screen.getByRole("button", { name: "Send feedback" }),
    );

    expect(toastError).toHaveBeenCalledWith(
      "Couldn't send your feedback. Check your connection and try again.",
    );
    expect(field).toHaveValue("Let me add half a glass");
  });

  it("changes nothing when cancelled", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mutate).not.toHaveBeenCalled();
  });
});
