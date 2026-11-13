import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Entry } from "./types";

// Bug #211: the placeholder shown while a Day loads must sit exactly where its Daily Total lands,
// so nothing shifts when the Entries arrive.

const state = vi.hoisted(() => ({
  today: "2026-11-13" as string | null,
  entries: undefined as Entry[] | undefined,
  goal: null as number | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("./use-today", () => ({ useToday: () => state.today }));
vi.mock("@/features/settings/queries", () => ({
  useSettings: () => ({ data: { dailyGoal: state.goal } }),
}));
vi.mock("@/features/toggles/queries", () => ({ useToggle: () => false }));
vi.mock("@/features/burned/burned-row", () => ({ BurnedRow: () => null }));
vi.mock("./picker-sheet", () => ({ FoodPickerSheet: () => null }));
vi.mock("./edit-entry-sheet", () => ({ EditEntrySheet: () => null }));
vi.mock("./queries", () => {
  const mutation = () => ({ mutate: vi.fn() });
  return {
    useDayEntries: () => ({
      data: state.entries,
      isPending: state.entries === undefined,
      isError: false,
      refetch: vi.fn(),
    }),
    useAddEntry: mutation,
    useAddEntries: mutation,
    useRemoveEntry: mutation,
    useRemoveEntries: mutation,
    useUpdateEntryQuantity: mutation,
    useUpdateEntryMealTime: mutation,
  };
});

import { TodayScreen } from "./today-screen";

const toast: Entry = {
  id: "toast",
  day: "2026-11-13",
  quantity: 2,
  createdAt: "2026-11-13T08:00:00Z",
  food: { id: "toast", name: "Toast", portion: "1 slice", calories: 110 },
};

const placeholder = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="daily-total-placeholder"]');
const total = () => screen.getByRole("region", { name: "Daily total" });

describe("Today while the Day loads", () => {
  beforeEach(() => {
    state.today = "2026-11-13";
    state.entries = undefined;
    state.goal = null;
  });

  it.each([
    ["without a Goal", null],
    ["with a Goal", 2200],
  ])("puts the Daily Total exactly where its placeholder was, %s", (_, goal) => {
    state.goal = goal;
    const { container, rerender } = render(<TodayScreen />);
    const loading = placeholder(container);
    if (!loading) throw new Error("No placeholder for the Daily Total");
    const column = loading.parentElement;
    const rows = [...loading.children].map((row) => row.className);

    state.entries = [toast];
    rerender(<TodayScreen />);

    // Nothing above it that the real total lacks, in the same column, with the same rows.
    expect(loading.previousElementSibling).toBeNull();
    expect(total().previousElementSibling).toBeNull();
    expect(total().parentElement).toBe(column);
    expect(total().className).toBe(
      loading.className.replace(" animate-pulse *:invisible", ""),
    );
    expect([...total().children].map((row) => row.className)).toEqual(rows);
  });

  it("holds the Day header's height before today is known", () => {
    state.today = null;
    state.goal = 2200;
    const { container } = render(<TodayScreen />);
    const loading = placeholder(container);

    expect(loading?.previousElementSibling).toHaveClass("h-11");
    expect(loading?.querySelector('[role="progressbar"]')).not.toBeNull();
  });
});
