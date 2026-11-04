import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "./domain";

const useSettings = vi.fn();
const mutate = vi.fn();
vi.mock("./queries", () => ({
  useSettings: () => useSettings(),
  useUpdateSettings: () => ({ mutate }),
}));

const push = vi.hoisted(() => ({
  vapidPublicKey: vi.fn(),
  canReceivePush: vi.fn(),
  currentEndpoint: vi.fn(),
  subscribeThisDevice: vi.fn(),
  unsubscribeThisDevice: vi.fn(),
  deviceTimeZone: vi.fn(),
}));
vi.mock("@/features/reminders/push", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/reminders/push")>()),
  ...push,
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

import { ReminderSection } from "./reminder-section";

const requestPermission = vi.fn();

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<ReminderSection />, { wrapper });
}

const settings = (patch: Partial<Settings> = {}) =>
  useSettings.mockReturnValue({ data: { ...DEFAULT_SETTINGS, ...patch } });
const reminderSwitch = () =>
  screen.findByRole("switch", { name: /daily reminder/i });

describe("ReminderSection", () => {
  beforeEach(() => {
    useSettings.mockReset();
    mutate.mockReset();
    toastError.mockReset();
    requestPermission.mockReset();
    for (const fn of Object.values(push)) fn.mockReset();
    push.vapidPublicKey.mockReturnValue("public-key");
    push.canReceivePush.mockReturnValue(true);
    push.currentEndpoint.mockResolvedValue(null);
    push.subscribeThisDevice.mockResolvedValue(undefined);
    push.unsubscribeThisDevice.mockResolvedValue(undefined);
    push.deviceTimeZone.mockReturnValue("Australia/Sydney");
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    settings();
  });

  it("is off by default, with no time to choose yet (AC-1)", async () => {
    renderSection();

    expect(await reminderSwitch()).not.toBeChecked();
    expect(screen.queryByLabelText("Remind me at")).not.toBeInTheDocument();
  });

  it("is not shown at all where this deployment has no push key yet", () => {
    push.vapidPublicKey.mockReturnValue(null);
    const { container } = renderSection();

    expect(container).toBeEmptyDOMElement();
  });

  it("says so, and cannot be switched on, on a device that can't show reminders (AC-2)", async () => {
    push.canReceivePush.mockReturnValue(false);
    renderSection();

    expect(await reminderSwitch()).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText("This device can't show reminders."),
    ).toBeInTheDocument();
  });

  it("asks for permission, subscribes this phone, and saves the Reminder with its time zone (AC-2, AC-3)", async () => {
    requestPermission.mockResolvedValue("granted");
    renderSection();

    await userEvent.click(await reminderSwitch());

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { reminderEnabled: true, timeZone: "Australia/Sydney" },
        expect.any(Object),
      ),
    );
    expect(requestPermission).toHaveBeenCalled();
    expect(push.subscribeThisDevice).toHaveBeenCalledWith("public-key");
  });

  it("stays off and explains when notifications are refused (AC-2)", async () => {
    requestPermission.mockResolvedValue("denied");
    renderSection();

    await userEvent.click(await reminderSwitch());

    expect(
      await screen.findByText(
        "Notifications are blocked for this app in Android settings.",
      ),
    ).toBeInTheDocument();
    expect(push.subscribeThisDevice).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
    expect(await reminderSwitch()).not.toBeChecked();
  });

  it("says so straight away when notifications were refused before (AC-2)", async () => {
    vi.stubGlobal("Notification", { permission: "denied", requestPermission });
    renderSection();

    expect(
      await screen.findByText(
        "Notifications are blocked for this app in Android settings.",
      ),
    ).toBeInTheDocument();
  });

  it("says nothing when the permission prompt is dismissed, and saves nothing", async () => {
    requestPermission.mockResolvedValue("default");
    renderSection();

    await userEvent.click(await reminderSwitch());

    await waitFor(() => expect(requestPermission).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("offers a retry when this phone could not be subscribed", async () => {
    requestPermission.mockResolvedValue("granted");
    push.subscribeThisDevice.mockRejectedValue(new Error("no network"));
    renderSection();

    await userEvent.click(await reminderSwitch());

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][1]).toMatchObject({
      action: { label: "Retry" },
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  describe("when it is on for this phone", () => {
    beforeEach(() => {
      settings({
        reminderEnabled: true,
        reminderTime: "19:00",
        timeZone: "Australia/Sydney",
      });
      push.currentEndpoint.mockResolvedValue("https://push.example.test/abc");
    });

    it("shows the switch on, with the time defaulting to 7:00 pm (AC-1)", async () => {
      renderSection();

      expect(await reminderSwitch()).toBeChecked();
      expect(screen.getByLabelText("Remind me at")).toHaveValue("19:00");
      expect(screen.getByLabelText("Remind me at")).toHaveAttribute(
        "step",
        "900",
      );
    });

    it("saves a new time on a quarter hour, with the device's time zone (AC-3)", async () => {
      renderSection();
      const time = await screen.findByLabelText("Remind me at");

      fireEvent.change(time, { target: { value: "07:45" } });

      expect(mutate).toHaveBeenCalledWith(
        { reminderTime: "07:45", timeZone: "Australia/Sydney" },
        expect.any(Object),
      );
    });

    it("rounds a time between quarter hours down", async () => {
      renderSection();
      const time = await screen.findByLabelText("Remind me at");

      fireEvent.change(time, { target: { value: "07:50" } });

      expect(mutate).toHaveBeenCalledWith(
        { reminderTime: "07:45", timeZone: "Australia/Sydney" },
        expect.any(Object),
      );
    });

    it("saves nothing when the time has not changed", async () => {
      renderSection();
      const time = await screen.findByLabelText("Remind me at");

      fireEvent.change(time, { target: { value: "19:10" } });

      expect(mutate).not.toHaveBeenCalled();
    });

    it("turns off for everyone, then forgets this phone once that is saved (AC-8)", async () => {
      mutate.mockImplementation((_patch, options) => options.onSuccess());
      renderSection();

      await userEvent.click(await reminderSwitch());

      expect(mutate).toHaveBeenCalledWith(
        { reminderEnabled: false },
        expect.any(Object),
      );
      await waitFor(() =>
        expect(push.unsubscribeThisDevice).toHaveBeenCalled(),
      );
    });

    it("keeps this phone subscribed if turning off did not save", async () => {
      renderSection();

      await userEvent.click(await reminderSwitch());

      expect(push.unsubscribeThisDevice).not.toHaveBeenCalled();
    });
  });

  it("explains when the Reminder is on for the User's other phones but not this one", async () => {
    settings({ reminderEnabled: true });
    push.currentEndpoint.mockResolvedValue(null);
    renderSection();

    expect(await reminderSwitch()).not.toBeChecked();
    expect(screen.getByText(/on for your other phones/i)).toBeInTheDocument();
  });
});
