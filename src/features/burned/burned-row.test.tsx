import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Entry } from "@/features/entries/types";
import { DEFAULT_SETTINGS } from "@/features/settings/domain";

const useSettings = vi.fn();
vi.mock("@/features/settings/queries", () => ({
  useSettings: () => useSettings(),
}));

const useDayBurned = vi.fn();
const mutate = vi.fn();
vi.mock("./queries", () => ({
  useDayBurned: (...args: unknown[]) => useDayBurned(...args),
  useSetBurned: () => ({ mutate }),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

import { BurnedRow } from "./burned-row";

const TODAY = "2026-11-04";
const entry = (calories: number, quantity = 1): Entry => ({
  id: crypto.randomUUID(),
  day: "2026-11-03",
  quantity,
  createdAt: "2026-11-03T08:00:00Z",
  food: { id: "f", name: "Toast", portion: "1 slice", calories },
});

function setup(options: {
  tracking?: boolean;
  burned?: number | null;
  pending?: boolean;
}) {
  useSettings.mockReturnValue({
    data: {
      ...DEFAULT_SETTINGS,
      trackCaloriesBurned: options.tracking ?? true,
    },
  });
  useDayBurned.mockReturnValue({
    data: options.burned ?? null,
    isPending: options.pending ?? false,
  });
}

describe("BurnedRow", () => {
  beforeEach(() => {
    useSettings.mockReset();
    useDayBurned.mockReset();
    mutate.mockReset();
    toastError.mockReset();
  });

  it("shows nothing at all for a User who does not track it (AC-2)", () => {
    setup({ tracking: false, burned: 2450 });
    const { container } = render(
      <BurnedRow day="2026-11-03" today={TODAY} entries={[entry(1840)]} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(useDayBurned).toHaveBeenCalledWith("2026-11-03", false);
  });

  it("shows nothing for a Day after today, and does not ask for it (AC-3)", () => {
    setup({});
    const { container } = render(
      <BurnedRow day="2026-11-05" today={TODAY} entries={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(useDayBurned).toHaveBeenCalledWith("2026-11-05", false);
  });

  it("invites you to add a figure when the Day has none (AC-3)", () => {
    setup({ burned: null });
    render(<BurnedRow day="2026-11-03" today={TODAY} entries={[]} />);

    expect(
      screen.getByRole("button", { name: /^Burned · Add$/ }),
    ).toBeInTheDocument();
  });

  it("shows the figure and the Deficit (AC-3)", () => {
    setup({ burned: 2450 });
    render(
      <BurnedRow day="2026-11-03" today={TODAY} entries={[entry(1840)]} />,
    );

    expect(
      screen.getByRole("button", {
        name: "Burned 2,450 kcal · 610 kcal deficit",
      }),
    ).toBeInTheDocument();
  });

  it("shows a Surplus when more was eaten than burned (AC-3)", () => {
    setup({ burned: 2450 });
    render(
      <BurnedRow day="2026-11-03" today={TODAY} entries={[entry(1325, 2)]} />,
    );

    expect(
      screen.getByRole("button", {
        name: "Burned 2,450 kcal · 200 kcal surplus",
      }),
    ).toBeInTheDocument();
  });

  it("asks you to log food when the Day has a figure but no Entries (AC-3)", () => {
    setup({ burned: 2450 });
    render(<BurnedRow day="2026-11-03" today={TODAY} entries={[]} />);

    expect(
      screen.getByRole("button", {
        name: "Burned 2,450 kcal · Log food to see your deficit",
      }),
    ).toBeInTheDocument();
  });

  it("says so far on today (AC-3)", () => {
    setup({ burned: 2450 });
    render(<BurnedRow day={TODAY} today={TODAY} entries={[entry(1840)]} />);

    expect(
      screen.getByRole("button", {
        name: "Burned so far 2,450 kcal · 610 kcal deficit",
      }),
    ).toBeInTheDocument();
  });

  it("holds its place while the figure loads", () => {
    setup({ pending: true });
    const { container } = render(
      <BurnedRow day="2026-11-03" today={TODAY} entries={[]} />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass("h-12");
  });

  it("opens a sheet to set the figure, and saves it for that Day (AC-4)", async () => {
    setup({ burned: null });
    render(<BurnedRow day="2026-11-03" today={TODAY} entries={[]} />);

    await userEvent.click(screen.getByRole("button", { name: /Burned/ }));
    const field = await screen.findByLabelText("Calories burned (kcal)");
    await userEvent.type(field, "2450");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mutate).toHaveBeenCalledWith(
      { day: "2026-11-03", calories: 2450 },
      expect.any(Object),
    );
  });

  it("clears the figure from the sheet (AC-4)", async () => {
    setup({ burned: 2450 });
    render(<BurnedRow day="2026-11-03" today={TODAY} entries={[]} />);

    await userEvent.click(screen.getByRole("button", { name: /Burned/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Clear" }));

    expect(mutate).toHaveBeenCalledWith(
      { day: "2026-11-03", calories: null },
      expect.any(Object),
    );
  });

  it("offers to retry when saving fails (AC-4)", async () => {
    setup({ burned: null });
    mutate.mockImplementation((_variables, options) =>
      options.onError(new Error("Couldn't save that.")),
    );
    render(<BurnedRow day="2026-11-03" today={TODAY} entries={[]} />);

    await userEvent.click(screen.getByRole("button", { name: /Burned/ }));
    await userEvent.type(
      await screen.findByLabelText("Calories burned (kcal)"),
      "2450",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(toastError).toHaveBeenCalledWith(
      "Couldn't save that.",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Retry" }),
      }),
    );
  });
});
