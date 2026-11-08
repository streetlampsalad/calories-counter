import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
vi.mock("./queries", () => ({
  useWithdrawFeatureRequest: () => ({ mutate, isPending: false }),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

import { WithdrawButton } from "./withdraw-button";

describe("WithdrawButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks first, and withdraws only once confirmed (US4.1)", async () => {
    render(<WithdrawButton id="r1" goal="Track water as well as food" />);

    await userEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(mutate).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("dialog", { name: "Withdraw this request?" }),
    ).toHaveTextContent("Track water as well as food");

    await userEvent.click(
      screen.getByRole("button", { name: "Withdraw request" }),
    );
    expect(mutate).toHaveBeenCalledWith("r1", expect.any(Object));
  });

  it("does nothing when the User keeps it", async () => {
    render(<WithdrawButton id="r1" goal="Track water as well as food" />);

    await userEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Keep it" }),
    );

    expect(mutate).not.toHaveBeenCalled();
  });

  it("says so when it couldn't be withdrawn", async () => {
    mutate.mockImplementation((_id, options) =>
      options.onError(
        new Error("Couldn't withdraw it. Check your connection and try again."),
      ),
    );
    render(<WithdrawButton id="r1" goal="Track water as well as food" />);

    await userEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Withdraw request" }),
    );

    expect(toastError).toHaveBeenCalledWith(
      "Couldn't withdraw it. Check your connection and try again.",
    );
  });
});
