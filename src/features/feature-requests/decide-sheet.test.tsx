import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
vi.mock("./queries", () => ({
  useDecide: () => ({ mutate, isPending: false }),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

import { DecideSheet } from "./decide-sheet";

async function open() {
  render(
    <DecideSheet id="r1" goal="Track water as well as food" decision="ready" />,
  );
  await userEvent.click(screen.getByRole("button", { name: "It's ready" }));
  return screen.findByRole("dialog", { name: "Turn it on for everyone?" });
}

describe("DecideSheet: It's ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks first, saying it is for everyone and can't be undone, then marks it ready (US2.1)", async () => {
    const sheet = await open();
    expect(mutate).not.toHaveBeenCalled();
    expect(sheet).toHaveTextContent("Track water as well as food");
    expect(sheet).toHaveTextContent(/every User/);
    expect(sheet).toHaveTextContent(/can't be undone/);

    await userEvent.click(
      screen.getByRole("button", { name: "Turn it on for everyone" }),
    );
    expect(mutate).toHaveBeenCalledWith(
      { id: "r1", decision: "ready" },
      expect.any(Object),
    );
  });

  it("changes nothing on Keep testing (US2.4)", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Keep testing" }));

    expect(mutate).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Turn it on for everyone?" }),
    ).not.toBeInTheDocument();
  });

  it("says so when it couldn't be done (US2.2, US2.3)", async () => {
    mutate.mockImplementation((_input, options) =>
      options.onError(
        new Error("Couldn't do that. Check your connection and try again."),
      ),
    );
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: "Turn it on for everyone" }),
    );

    expect(toastError).toHaveBeenCalledWith(
      "Couldn't do that. Check your connection and try again.",
    );
  });
});
