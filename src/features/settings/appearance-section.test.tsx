import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setTheme = vi.fn();
let theme: string | undefined;
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme, setTheme }),
}));

import { AppearanceSection } from "./appearance-section";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  theme = undefined;
});

describe("AppearanceSection", () => {
  it("offers Light, Dark and System, with Light selected when nothing is saved (US1.1, US1.3)", () => {
    render(<AppearanceSection />);

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
});
