import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "./domain";

const useSettings = vi.fn();
const mutate = vi.fn();
vi.mock("./queries", () => ({
  useSettings: () => useSettings(),
  useUpdateSettings: () => ({ mutate }),
}));

import { BurnedSection } from "./burned-section";

const burnedSwitch = () =>
  screen.getByRole("switch", { name: "Track calories burned" });

describe("BurnedSection", () => {
  beforeEach(() => {
    useSettings.mockReset();
    mutate.mockReset();
    useSettings.mockReturnValue({ data: DEFAULT_SETTINGS, isPending: false });
  });

  it("is off by default (AC-1)", () => {
    render(<BurnedSection />);

    expect(burnedSwitch()).not.toBeChecked();
  });

  it("shows on when the User tracks it", () => {
    useSettings.mockReturnValue({
      data: { ...DEFAULT_SETTINGS, trackCaloriesBurned: true },
      isPending: false,
    });
    render(<BurnedSection />);

    expect(burnedSwitch()).toBeChecked();
  });

  it("saves the switch being turned on (AC-1)", async () => {
    render(<BurnedSection />);

    await userEvent.click(burnedSwitch());

    expect(mutate).toHaveBeenCalledWith(
      { trackCaloriesBurned: true },
      expect.any(Object),
    );
  });

  it("saves the switch being turned off", async () => {
    useSettings.mockReturnValue({
      data: { ...DEFAULT_SETTINGS, trackCaloriesBurned: true },
      isPending: false,
    });
    render(<BurnedSection />);

    await userEvent.click(burnedSwitch());

    expect(mutate).toHaveBeenCalledWith(
      { trackCaloriesBurned: false },
      expect.any(Object),
    );
  });

  it("says that switching it off keeps what was entered (AC-2)", () => {
    render(<BurnedSection />);

    expect(screen.getByText(/keeps what you entered/i)).toBeInTheDocument();
  });

  it("holds its place while settings load", () => {
    useSettings.mockReturnValue({ data: undefined, isPending: true });
    render(<BurnedSection />);

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
