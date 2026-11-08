import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useToggle = vi.fn();
const useToggles = vi.fn();
vi.mock("@/features/toggles/queries", () => ({
  useToggle: (key: string) => useToggle(key),
  useToggles: () => useToggles(),
}));

const setTheme = vi.fn();
let theme: string | undefined;
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme, setTheme }),
}));

import { APPEARANCE_STORAGE_KEY } from "@/lib/appearance";
import { AppearanceCleanup, AppearanceSection } from "./appearance-section";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  theme = undefined;
  useToggle.mockReturnValue(true);
});

describe("AppearanceSection", () => {
  it("offers Light, Dark and System, with Light selected when nothing is saved (US1.1, US1.3)", () => {
    render(<AppearanceSection />);

    expect(useToggle).toHaveBeenCalledWith("feature-146");
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Dark" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "System" })).not.toBeChecked();
  });

  it("selects the current choice (US1.1)", () => {
    theme = "dark";
    render(<AppearanceSection />);

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });

  it("applies the choice at once (US1.4, US1.6)", async () => {
    render(<AppearanceSection />);

    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));

    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("is not there while its Toggle is off, loading or failed (US1.2)", () => {
    useToggle.mockReturnValue(false);
    const { container } = render(<AppearanceSection />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("AppearanceCleanup", () => {
  it("clears a saved choice once Toggles have loaded and the Toggle is off (US1.9)", () => {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, "dark");
    useToggles.mockReturnValue({
      isSuccess: true,
      data: [{ key: "feature-146", isOn: false }],
    });

    render(<AppearanceCleanup />);

    expect(setTheme).toHaveBeenCalledWith("light");
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBeNull();
  });

  it("keeps the saved choice while Toggles are loading or failed (US1.9)", () => {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, "dark");
    useToggles.mockReturnValue({ isSuccess: false, data: undefined });

    render(<AppearanceCleanup />);

    expect(setTheme).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe("dark");
  });

  it("keeps the saved choice while the Toggle is on", () => {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, "dark");
    useToggles.mockReturnValue({
      isSuccess: true,
      data: [{ key: "feature-146", isOn: true }],
    });

    render(<AppearanceCleanup />);

    expect(setTheme).not.toHaveBeenCalled();
  });

  it("does nothing when nothing is saved", () => {
    useToggles.mockReturnValue({ isSuccess: true, data: [] });

    render(<AppearanceCleanup />);

    expect(setTheme).not.toHaveBeenCalled();
  });
});
