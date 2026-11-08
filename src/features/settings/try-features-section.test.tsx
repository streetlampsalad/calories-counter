import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Toggle } from "@/features/toggles/queries";

const useToggles = vi.fn();
const mutate = vi.fn();
vi.mock("@/features/toggles/queries", () => ({
  useToggles: () => useToggles(),
  useSwitchToggle: () => ({ mutate }),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

import { TryFeaturesSection } from "./try-features-section";

const toggle = (overrides: Partial<Toggle>): Toggle => ({
  key: "feature-1",
  title: "Meal groups",
  state: "testing",
  isOn: false,
  canSwitch: true,
  ...overrides,
});

const heading = () =>
  screen.queryByRole("heading", { name: "Try new features" });

describe("TryFeaturesSection", () => {
  beforeEach(() => {
    useToggles.mockReset();
    mutate.mockReset();
    toastError.mockReset();
  });

  it("lists each Toggle the Owner can try, showing whether it is on for them (US2.1)", () => {
    useToggles.mockReturnValue({
      data: [
        toggle({ key: "feature-1", title: "Meal groups", isOn: true }),
        toggle({ key: "feature-2", title: "Water tracking", isOn: false }),
        toggle({
          key: "feature-3",
          title: "Already live",
          state: "live",
          isOn: true,
          canSwitch: false,
        }),
      ],
    });
    render(<TryFeaturesSection />);

    expect(heading()).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Meal groups" })).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Water tracking" }),
    ).not.toBeChecked();
    expect(
      screen.queryByRole("switch", { name: "Already live" }),
    ).not.toBeInTheDocument();
  });

  it("turns a Toggle on for the Owner (US2.2)", async () => {
    useToggles.mockReturnValue({ data: [toggle({ isOn: false })] });
    render(<TryFeaturesSection />);

    await userEvent.click(screen.getByRole("switch", { name: "Meal groups" }));

    expect(mutate).toHaveBeenCalledWith(
      { key: "feature-1", on: true },
      expect.any(Object),
    );
  });

  it("says so when saving fails (US2.3)", async () => {
    useToggles.mockReturnValue({ data: [toggle({ isOn: false })] });
    mutate.mockImplementation((_variables, options) =>
      options.onError(
        new Error("Couldn't save. Check your connection and try again."),
      ),
    );
    render(<TryFeaturesSection />);

    await userEvent.click(screen.getByRole("switch", { name: "Meal groups" }));

    expect(toastError).toHaveBeenCalledWith(
      "Couldn't save. Check your connection and try again.",
      expect.any(Object),
    );
  });

  it("is hidden from a User who can try nothing (US2.4)", () => {
    useToggles.mockReturnValue({
      data: [toggle({ canSwitch: false })],
    });
    const { container } = render(<TryFeaturesSection />);

    expect(container).toBeEmptyDOMElement();
  });

  it("is hidden when there is no Toggle in Testing (US2.5)", () => {
    useToggles.mockReturnValue({ data: [] });
    const { container } = render(<TryFeaturesSection />);

    expect(container).toBeEmptyDOMElement();
  });

  it("is hidden while loading and after an error", () => {
    useToggles.mockReturnValue({ data: undefined });
    const { container } = render(<TryFeaturesSection />);

    expect(container).toBeEmptyDOMElement();
  });
});
