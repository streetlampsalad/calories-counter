import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DailyTotal, EntryList } from "./entry-list";
import type { Entry } from "./types";

const entry = (
  name: string,
  quantity: number,
  calories: number,
  portion = "1 slice",
): Entry => ({
  id: name,
  day: "2026-11-03",
  quantity,
  createdAt: "2026-11-03T08:00:00Z",
  food: { id: name, name, portion, calories },
});

describe("EntryList", () => {
  it("shows each Entry as Food name, then Quantity × Portion and calories", () => {
    render(
      <EntryList
        entries={[entry("Toast", 1.5, 110), entry("Rice", 2, 130, "100 g")]}
      />,
    );

    const rows = within(
      screen.getByRole("list", { name: "Entries" }),
    ).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Toast");
    expect(rows[0]).toHaveTextContent("1½ × 1 slice · 165 kcal");
    expect(rows[1]).toHaveTextContent("2 × 100 g · 260 kcal");
  });

  it("keeps the order it is given (newest first)", () => {
    render(
      <EntryList entries={[entry("Newest", 1, 10), entry("Oldest", 1, 10)]} />,
    );

    const names = screen.getAllByRole("listitem").map((row) => row.textContent);
    expect(names[0]).toContain("Newest");
    expect(names[1]).toContain("Oldest");
  });

  it("says so when nothing has been logged", () => {
    render(<EntryList entries={[]} />);

    expect(screen.getByText("Nothing logged yet")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("is plain text unless the caller wants Entries to be tappable", () => {
    render(<EntryList entries={[entry("Toast", 1, 110)]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens an Entry when it is tapped", async () => {
    const onSelect = vi.fn();
    const toast = entry("Toast", 1, 110);
    render(<EntryList entries={[toast]} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: /Toast/ }));

    expect(onSelect).toHaveBeenCalledWith(toast);
  });
});

describe("DailyTotal", () => {
  it("shows the sum of the Day's Entries in large type", () => {
    render(
      <DailyTotal
        entries={[entry("Toast", 1.5, 110), entry("Rice", 2, 130)]}
      />,
    );

    const total = screen.getByRole("region", { name: "Daily total" });
    expect(total).toHaveTextContent("425");
    expect(total).toHaveTextContent("kcal");
  });

  it("shows zero for a Day with nothing logged", () => {
    render(<DailyTotal entries={[]} />);

    expect(
      screen.getByRole("region", { name: "Daily total" }),
    ).toHaveTextContent("0");
  });

  it("uses thousands separators", () => {
    render(<DailyTotal entries={[entry("Feast", 10, 150)]} />);

    expect(
      screen.getByRole("region", { name: "Daily total" }),
    ).toHaveTextContent("1,500");
  });
});
