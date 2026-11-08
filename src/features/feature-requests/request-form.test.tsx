import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const mutate = vi.fn();
const useMyFeatureRequests = vi.fn();
vi.mock("./queries", () => ({
  useMyFeatureRequests: () => useMyFeatureRequests(),
  useSubmitFeatureRequest: () => ({ mutate, isPending: false }),
}));

const canReceivePush = vi.fn();
const subscribeThisDevice = vi.fn();
vi.mock("@/features/reminders/push", () => ({
  canReceivePush: () => canReceivePush(),
  vapidPublicKey: () => "public-key",
  subscribeThisDevice: (key: string) => subscribeThisDevice(key),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

import { RequestForm } from "./request-form";

const goal = () =>
  screen.getByRole("textbox", { name: /What would you like to be able to do/ });
const problem = () =>
  screen.getByRole("textbox", { name: /What's getting in the way today/ });
const send = () => screen.getByRole("button", { name: "Send request" });

function stubNotification(permission: NotificationPermission) {
  const requestPermission = vi.fn(async () => "granted" as const);
  vi.stubGlobal("Notification", { permission, requestPermission });
  return requestPermission;
}

describe("RequestForm", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    useMyFeatureRequests.mockReturnValue({ data: [] });
    canReceivePush.mockReturnValue(false);
  });

  it("says the request is posted publicly on GitHub", () => {
    render(<RequestForm />);

    expect(screen.getByText(/posted publicly on GitHub/)).toBeInTheDocument();
  });

  it("doesn't send without a goal of at least 10 characters, and says why (US1.3)", async () => {
    render(<RequestForm />);

    await userEvent.type(goal(), "Water");
    await userEvent.click(send());

    expect(mutate).not.toHaveBeenCalled();
    expect(goal()).toHaveAccessibleDescription(
      expect.stringContaining("at least 10 characters"),
    );
    expect(goal()).toHaveAttribute("aria-invalid", "true");
  });

  it("gently asks for more detail under 100 characters, without blocking (US1.4)", async () => {
    render(<RequestForm />);

    await userEvent.type(goal(), "Track water as well as food");
    expect(
      screen.getByText(/More detail means a closer result/),
    ).toBeInTheDocument();

    await userEvent.type(problem(), "x".repeat(80));
    expect(
      screen.queryByText(/More detail means a closer result/),
    ).not.toBeInTheDocument();
  });

  it("sends what the User wrote and goes back to the list (US1.5)", async () => {
    mutate.mockImplementation((_input, options) =>
      options.onSuccess({ id: "new-id" }),
    );
    render(<RequestForm />);

    await userEvent.type(goal(), "Track water as well as food");
    await userEvent.type(problem(), "I forget to drink");
    await userEvent.click(send());

    expect(mutate).toHaveBeenCalledWith(
      {
        goal: "Track water as well as food",
        problem: "I forget to drink",
        details: "",
      },
      expect.any(Object),
    );
    expect(push).toHaveBeenCalledWith("/settings/feature-requests");
  });

  it("can't be sent while 2 requests are being worked on (US1.7)", () => {
    useMyFeatureRequests.mockReturnValue({
      data: [
        { stage: "submitted", withdrawnAt: null },
        { stage: "building", withdrawnAt: null },
      ],
    });
    render(<RequestForm />);

    expect(
      screen.getByText(/You can have 2 requests at a time/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send request" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to your requests" }),
    ).toHaveAttribute("href", "/settings/feature-requests");
  });

  it("offers notifications while permission is undecided, and subscribes this phone (US1.8)", async () => {
    canReceivePush.mockReturnValue(true);
    const requestPermission = stubNotification("default");
    render(<RequestForm />);

    await userEvent.click(
      screen.getByRole("button", { name: "Notify me when it's ready" }),
    );

    expect(requestPermission).toHaveBeenCalled();
    expect(subscribeThisDevice).toHaveBeenCalledWith("public-key");
    expect(
      await screen.findByText(/You'll get a notification/),
    ).toBeInTheDocument();
  });

  it("still sends when notifications are declined (US1.8)", async () => {
    canReceivePush.mockReturnValue(true);
    const requestPermission = stubNotification("default");
    requestPermission.mockResolvedValue("denied" as never);
    render(<RequestForm />);

    await userEvent.click(
      screen.getByRole("button", { name: "Notify me when it's ready" }),
    );
    await userEvent.type(goal(), "Track water as well as food");
    await userEvent.click(send());

    expect(subscribeThisDevice).not.toHaveBeenCalled();
    expect(mutate).toHaveBeenCalled();
  });

  it("doesn't offer notifications once they are already on", () => {
    canReceivePush.mockReturnValue(true);
    stubNotification("granted");
    render(<RequestForm />);

    expect(
      screen.queryByRole("button", { name: "Notify me when it's ready" }),
    ).not.toBeInTheDocument();
  });

  it("keeps what was typed and says so when it couldn't be sent (US1.9)", async () => {
    mutate.mockImplementation((_input, options) =>
      options.onError(
        new Error(
          "Couldn't send your request. Check your connection and try again.",
        ),
      ),
    );
    render(<RequestForm />);

    await userEvent.type(goal(), "Track water as well as food");
    await userEvent.click(send());

    expect(toastError).toHaveBeenCalledWith(
      "Couldn't send your request. Check your connection and try again.",
    );
    expect(goal()).toHaveValue("Track water as well as food");
    expect(push).not.toHaveBeenCalled();
  });
});
