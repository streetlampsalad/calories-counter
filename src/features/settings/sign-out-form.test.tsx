import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const unsubscribeThisDevice = vi.fn();
vi.mock("@/features/reminders/push", () => ({
  unsubscribeThisDevice: () => unsubscribeThisDevice(),
}));

import { SignOutForm } from "./sign-out-form";

describe("SignOutForm", () => {
  beforeEach(() => {
    unsubscribeThisDevice.mockReset();
  });

  it("forgets this phone's Reminder subscription, then signs out (AC-8)", async () => {
    const order: string[] = [];
    unsubscribeThisDevice.mockImplementation(async () => {
      order.push("unsubscribe");
    });
    const action = vi.fn(async () => {
      order.push("sign out");
    });
    render(<SignOutForm action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(order).toEqual(["unsubscribe", "sign out"]);
  });

  it("still signs out when forgetting the subscription fails", async () => {
    unsubscribeThisDevice.mockImplementation(async () => {
      throw new Error("offline");
    });
    const action = vi.fn(async () => {});
    render(<SignOutForm action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });
});
