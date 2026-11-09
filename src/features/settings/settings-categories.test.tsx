import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Toggle } from "@/features/toggles/queries";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

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

const toggle = (isOn: boolean): Toggle => ({
  key: "feature-167",
  title: "Organise Settings into categories.",
  state: "testing",
  isOn,
  canSwitch: false,
});

beforeEach(() => {
  vi.clearAllMocks();
  query = { data: [toggle(true)], isPending: false };
});

describe("SettingsHome", () => {
  it("lists Tracking, Preferences and Features, then About and Account, when on (US1.1)", () => {
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

  it("is the single list when off (US1.2)", () => {
    query = { data: [toggle(false)], isPending: false };
    render(<SettingsHome>About and Account</SettingsHome>);

    expect(screen.queryByRole("link", { name: /Tracking/ })).toBeNull();
    expect(screen.getByText("goal-section")).toBeInTheDocument();
    expect(screen.getByText("feature-requests-row")).toBeInTheDocument();
    expect(screen.getByText("About and Account")).toBeInTheDocument();
  });

  it.each([
    ["loading", { data: undefined, isPending: true }],
    ["failed", { data: undefined, isPending: false }],
  ])("is the single list while Toggles are %s (US1.9)", (_, state) => {
    query = state;
    render(<SettingsHome>About and Account</SettingsHome>);

    expect(screen.getByText("goal-section")).toBeInTheDocument();
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
  it("shows the category's sections and a link back to Settings when on (US1.3, US1.6)", () => {
    render(<SettingsCategoryPage id="tracking" />);

    expect(
      screen.getByRole("heading", { name: "Tracking" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("goal-section").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends the User to /settings when off (US1.8)", () => {
    query = { data: [toggle(false)], isPending: false };
    render(<SettingsCategoryPage id="preferences" />);

    expect(replace).toHaveBeenCalledWith("/settings");
    expect(screen.queryByRole("heading", { name: "Preferences" })).toBeNull();
  });

  it("waits while Toggles load, without redirecting (US1.8)", () => {
    query = { data: undefined, isPending: true };
    render(<SettingsCategoryPage id="features" />);

    expect(replace).not.toHaveBeenCalled();
  });
});
