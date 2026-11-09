import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Toggle } from "@/features/toggles/queries";

let query: { data?: Toggle[]; isPending: boolean };
vi.mock("@/features/toggles/queries", () => ({
  useToggles: () => query,
}));

vi.mock("./goal-section", () => ({ GoalSection: () => <p>goal-section</p> }));
vi.mock("./burned-section", () => ({
  BurnedSection: () => <p>burned-section</p>,
}));
vi.mock("./week-start-section", () => ({
  WeekStartSection: () => <p>week-start-section</p>,
}));
vi.mock("./reminder-section", () => ({
  ReminderSection: () => <p>reminder-section</p>,
}));
vi.mock("./vibration-section", () => ({
  VibrationSection: () => <p>vibration-section</p>,
}));
vi.mock("./appearance-section", () => ({
  AppearanceSection: () => <p>appearance-section</p>,
}));
vi.mock("./try-features-section", () => ({
  TryFeaturesSection: () => <p>try-features-section</p>,
}));
vi.mock("./feature-requests-row", () => ({
  FeatureRequestsRow: () => <p>feature-requests-row</p>,
}));

import type { SettingsCategory } from "./categories";
import { SettingsCategoryPage, SettingsHome } from "./settings-categories";

beforeEach(() => {
  query = { data: [], isPending: false };
});

describe("SettingsHome", () => {
  it("lists Tracking, Preferences and Features, then About and Account (US1.1)", () => {
    render(<SettingsHome>About and Account</SettingsHome>);

    expect(screen.getByRole("link", { name: /Tracking/ })).toHaveAttribute(
      "href",
      "/settings/tracking",
    );
    expect(screen.getByRole("link", { name: /Preferences/ })).toHaveAttribute(
      "href",
      "/settings/preferences",
    );
    expect(screen.getByRole("link", { name: /Features/ })).toHaveAttribute(
      "href",
      "/settings/features",
    );
    expect(screen.getByText("About and Account")).toBeInTheDocument();
    expect(screen.queryByText("goal-section")).not.toBeInTheDocument();
  });

  it("hides a category with no section visible (US1.7)", () => {
    const categories: SettingsCategory[] = [
      {
        id: "tracking",
        title: "Tracking",
        description: "",
        hasVisibleSection: () => true,
      },
      {
        id: "features",
        title: "Features",
        description: "",
        hasVisibleSection: () => false,
      },
    ];
    render(
      <SettingsHome categories={categories}>About and Account</SettingsHome>,
    );

    expect(screen.getByRole("link", { name: /Tracking/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Features/ })).toBeNull();
  });
});

describe("SettingsCategoryPage", () => {
  it("shows the category's sections and a link back to Settings (US1.3, US1.6)", () => {
    render(<SettingsCategoryPage id="tracking" />);

    expect(
      screen.getByRole("heading", { name: "Tracking" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("goal-section").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });
});
