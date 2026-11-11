import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Toggle } from "@/features/toggles/queries";

const mutate = vi.fn();
let sentToday: { data?: number; isPending?: boolean; isError?: boolean };
vi.mock("./queries", () => ({
  useSentToday: () => sentToday,
  useSendBugReport: () => ({ mutate, isPending: false }),
}));

const canReceivePush = vi.fn();
const subscribeThisDevice = vi.fn();
vi.mock("@/features/reminders/push", () => ({
  canReceivePush: () => canReceivePush(),
  vapidPublicKey: () => "public-key",
  subscribeThisDevice: (key: string) => subscribeThisDevice(key),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

let toggles: { data?: Toggle[]; isPending: boolean; isError: boolean };
vi.mock("@/features/toggles/queries", () => ({
  useToggles: () => toggles,
}));

import { BugReportForm } from "./bug-report-form";
import type { Device } from "./device";

const DEVICE: Device = {
  model: "Pixel 7",
  os: "Android 16",
  browser: "Chrome 142",
  openedAs: "Installed app",
  screen: "412 × 915 at 2.63×",
  appearance: "System",
  timeZone: "Australia/Sydney",
};
let describe_: () => Promise<Device>;
vi.mock("./device", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./device")>()),
  describeDevice: () => describe_(),
}));

const toggle = (overrides: Partial<Toggle>): Toggle => ({
  key: "feature-1",
  title: "A feature",
  state: "live",
  isOn: true,
  canSwitch: false,
  ...overrides,
});

const wentWrong = () =>
  screen.getByRole("textbox", { name: /What went wrong/ });
const send = () => screen.getByRole("button", { name: "Send report" });
const attached = () =>
  screen.getByRole("region", { name: "Attached to your report" });

describe("BugReportForm", () => {
  beforeEach(() => {
    mutate.mockReset();
    sentToday = { data: 0 };
    toggles = { data: [], isPending: false, isError: false };
    canReceivePush.mockReset().mockReturnValue(false);
    subscribeThisDevice.mockReset();
    describe_ = async () => DEVICE;
  });

  it("says the report is posted publicly, and points feature feedback to Give feedback (US1.4)", () => {
    render(<BugReportForm version="abc1234" />);

    expect(screen.getByText(/posted publicly on GitHub/)).toBeInTheDocument();
    expect(
      screen.getByText(/Give feedback.* on its request instead/),
    ).toBeInTheDocument();
  });

  it("doesn't send a short What went wrong, or no severity, and says what each needs (US1.3)", async () => {
    render(<BugReportForm version="abc1234" />);

    await userEvent.type(wentWrong(), "Broken");
    await userEvent.click(send());

    expect(mutate).not.toHaveBeenCalled();
    expect(wentWrong()).toHaveAccessibleDescription(
      expect.stringContaining("at least 10 characters"),
    );
    expect(wentWrong()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Choose how bad it is.")).toBeInTheDocument();
  });

  it("lists the Toggles on, Testing first, with the app version (US1.5)", () => {
    toggles = {
      data: [
        toggle({ key: "feature-173", title: "Meal times", state: "live" }),
        toggle({ key: "feature-192", title: "Report a bug", state: "testing" }),
        toggle({ key: "feature-9", title: "Off one", isOn: false }),
      ],
      isPending: false,
      isError: false,
    };
    render(<BugReportForm version="abc1234" />);

    const items = within(attached()).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Report a bug (feature-192): Testing",
      "Meal times (feature-173): Live",
    ]);
    expect(
      within(attached()).getByText(/App version: abc1234/),
    ).toBeInTheDocument();
    expect(within(attached()).queryByText(/Off one/)).not.toBeInTheDocument();
  });

  it("lists the device after the app version, as the Issue will (US2.1, US2.4, FR-007)", async () => {
    render(<BugReportForm version="abc1234" />);

    expect(await within(attached()).findByText("Model: Pixel 7")).toBeVisible();
    const lines = within(attached())
      .getAllByText(/^[A-Z][A-Za-z ]+: /)
      .map((line) => line.textContent);
    expect(lines).toEqual([
      "App version: abc1234",
      "Model: Pixel 7",
      "Operating system: Android 16",
      "Browser: Chrome 142",
      "Opened as: Installed app",
      "Screen: 412 × 915 at 2.63×",
      "Appearance: System",
      "Time zone: Australia/Sydney",
    ]);
  });

  it("says Checking… for the device while it is described, and still sends without it", async () => {
    describe_ = () => new Promise<Device>(() => {});
    render(<BugReportForm version="abc1234" />);

    expect(within(attached()).getAllByText("Checking…")).toHaveLength(1);
    await userEvent.type(wentWrong(), "The Today total is wrong");
    await userEvent.click(
      screen.getByRole("radio", { name: "I can't finish what I was doing" }),
    );
    await userEvent.click(send());

    expect(mutate).toHaveBeenCalledWith(
      expect.not.objectContaining({ device: expect.anything() }),
      expect.any(Object),
    );
  });

  it("says Couldn't be read for the device when it can't be described, and sends without it", async () => {
    describe_ = () => Promise.reject(new Error("no"));
    render(<BugReportForm version="abc1234" />);

    expect(
      await within(attached()).findByText("Device: Couldn't be read"),
    ).toBeInTheDocument();
    await userEvent.type(wentWrong(), "The Today total is wrong");
    await userEvent.click(
      screen.getByRole("radio", { name: "I can't finish what I was doing" }),
    );
    await userEvent.click(send());

    expect(mutate).toHaveBeenCalledWith(
      expect.not.objectContaining({ device: expect.anything() }),
      expect.any(Object),
    );
  });

  it("says No Toggles on when none are (US1.5)", () => {
    render(<BugReportForm version="abc1234" />);
    expect(within(attached()).getByText("No Toggles on")).toBeInTheDocument();
  });

  it("says Checking… while the Toggles load, and Couldn't be read on an error", async () => {
    toggles = { isPending: true, isError: false };
    const { rerender } = render(<BugReportForm version="abc1234" />);
    await screen.findByText("Model: Pixel 7");
    expect(within(attached()).getByText("Checking…")).toBeInTheDocument();

    toggles = { isPending: false, isError: true };
    rerender(<BugReportForm version="abc1234" />);
    expect(
      within(attached()).getByText("Couldn't be read"),
    ).toBeInTheDocument();
  });

  it("sends what was typed and chosen, then says Sent with the link and clears the fields (US1.8)", async () => {
    mutate.mockImplementation((_input, options) =>
      options.onSuccess({
        issue: 321,
        url: "https://github.com/streetlampsalad/calories-counter/issues/321",
      }),
    );
    render(<BugReportForm version="abc1234" />);

    await userEvent.type(wentWrong(), "The Today total is wrong");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /Where in the app/ }),
      "today",
    );
    await userEvent.click(
      screen.getByRole("radio", {
        name: "It's annoying, but I can work around it",
      }),
    );
    await userEvent.click(send());

    expect(mutate).toHaveBeenCalledWith(
      {
        whatWentWrong: "The Today total is wrong",
        expected: "",
        howItHappened: "",
        screen: "today",
        severity: "annoying",
        device: DEVICE,
      },
      expect.any(Object),
    );
    const sent = screen.getByRole("status");
    expect(sent).toHaveTextContent("Sent");
    expect(within(sent).getByRole("link", { name: /#321/ })).toHaveAttribute(
      "href",
      "https://github.com/streetlampsalad/calories-counter/issues/321",
    );
    expect(wentWrong()).toHaveValue("");
    expect(
      screen.getByRole("radio", {
        name: "It's annoying, but I can work around it",
      }),
    ).not.toBeChecked();
  });

  it("keeps what was typed and says it couldn't be sent when sending fails (US1.10)", async () => {
    mutate.mockImplementation((_input, options) =>
      options.onError(
        new Error(
          "Couldn't send your report. Check your connection and try again.",
        ),
      ),
    );
    render(<BugReportForm version="abc1234" />);

    await userEvent.type(wentWrong(), "The Today total is wrong");
    await userEvent.click(
      screen.getByRole("radio", { name: "I can't finish what I was doing" }),
    );
    await userEvent.click(send());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't send your report. Check your connection and try again.",
    );
    expect(wentWrong()).toHaveValue("The Today total is wrong");
  });

  it("says they can send 5 a day and can't send after 5 (US1.9)", () => {
    sentToday = { data: 5 };
    render(<BugReportForm version="abc1234" />);

    expect(
      screen.getByText(/You can send 5 bug reports a day/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send report" }),
    ).not.toBeInTheDocument();
  });

  describe("notifications (US3.8)", () => {
    const notify = () =>
      screen.queryByRole("button", { name: "Notify me about this report" });

    function stubNotification(permission: NotificationPermission) {
      const requestPermission = vi.fn(async () => "granted" as const);
      vi.stubGlobal("Notification", { permission, requestPermission });
      return requestPermission;
    }

    it("offers notifications while permission is undecided, and subscribes this phone", async () => {
      canReceivePush.mockReturnValue(true);
      const requestPermission = stubNotification("default");
      render(<BugReportForm version="abc1234" />);

      await userEvent.click(notify() as HTMLElement);

      expect(requestPermission).toHaveBeenCalled();
      expect(subscribeThisDevice).toHaveBeenCalledWith("public-key");
      expect(
        await screen.findByText(/You'll get a notification/),
      ).toBeInTheDocument();
    });

    it("still sends when notifications are declined", async () => {
      canReceivePush.mockReturnValue(true);
      stubNotification("default").mockResolvedValue("denied" as never);
      render(<BugReportForm version="abc1234" />);

      await userEvent.click(notify() as HTMLElement);
      await userEvent.type(wentWrong(), "The total is wrong after I edit");
      await userEvent.click(
        screen.getByRole("radio", { name: /It's annoying/ }),
      );
      await userEvent.click(send());

      expect(subscribeThisDevice).not.toHaveBeenCalled();
      expect(mutate).toHaveBeenCalled();
    });

    it("doesn't offer them once decided, or where push isn't supported", () => {
      canReceivePush.mockReturnValue(true);
      stubNotification("granted");
      const { unmount } = render(<BugReportForm version="abc1234" />);
      expect(notify()).not.toBeInTheDocument();
      unmount();

      canReceivePush.mockReturnValue(false);
      stubNotification("default");
      render(<BugReportForm version="abc1234" />);
      expect(notify()).not.toBeInTheDocument();
    });
  });
});
