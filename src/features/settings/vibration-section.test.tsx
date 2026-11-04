import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isVibrationOn } from "@/lib/haptics";
import { VibrationSection } from "./vibration-section";

function supportVibration(supported: boolean) {
  Object.defineProperty(navigator, "vibrate", {
    configurable: true,
    writable: true,
    value: supported ? vi.fn(() => true) : undefined,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  supportVibration(true);
});

describe("VibrationSection", () => {
  it("offers a Vibration switch, on by default", () => {
    render(<VibrationSection />);

    expect(screen.getByRole("switch", { name: "Vibration" })).toBeChecked();
  });

  it("turns vibration off and on, and remembers it on this device", async () => {
    render(<VibrationSection />);
    const toggle = screen.getByRole("switch", { name: "Vibration" });

    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(isVibrationOn()).toBe(false);

    await userEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(isVibrationOn()).toBe(true);
  });

  it("can be turned on and off by tapping its label, a bigger target than the switch", async () => {
    render(<VibrationSection />);

    await userEvent.click(screen.getByText("Vibration"));

    expect(screen.getByRole("switch", { name: "Vibration" })).not.toBeChecked();
  });

  it("shows the saved choice when it opens", () => {
    window.localStorage.setItem("vibration", "off");

    render(<VibrationSection />);

    expect(screen.getByRole("switch", { name: "Vibration" })).not.toBeChecked();
  });

  it("says the choice belongs to this phone", () => {
    render(<VibrationSection />);

    expect(screen.getByText(/this phone/i)).toBeInTheDocument();
  });

  it("is hidden on a device that cannot vibrate", () => {
    supportVibration(false);

    render(<VibrationSection />);

    expect(
      screen.queryByRole("switch", { name: "Vibration" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Vibration")).not.toBeInTheDocument();
  });
});
