import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("EntryList selection", () => {
  const toast = entry("Toast", 1, 110);
  const rice = entry("Rice", 2, 130, "100 g");

  function open(selected: string[] = []) {
    const onSelect = vi.fn();
    const onStart = vi.fn();
    const onToggle = vi.fn();
    render(
      <EntryList
        entries={[toast, rice]}
        onSelect={onSelect}
        selection={{
          selecting: selected.length > 0,
          isSelected: (id) => selected.includes(id),
          onStart,
          onToggle,
        }}
      />,
    );
    return { onSelect, onStart, onToggle };
  }

  describe("holding", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("starts selection with the held Entry, and does not open it", () => {
      const { onSelect, onStart } = open();
      const row = screen.getByRole("button", { name: /Toast/ });

      fireEvent.pointerDown(row, { clientX: 5, clientY: 5 });
      act(() => vi.advanceTimersByTime(500));
      fireEvent.pointerUp(row);
      fireEvent.click(row);

      expect(onStart).toHaveBeenCalledWith(toast);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  it("opens an Entry on a tap when nothing is selected", async () => {
    const { onSelect, onToggle } = open();

    await userEvent.click(screen.getByRole("button", { name: /Toast/ }));

    expect(onSelect).toHaveBeenCalledWith(toast);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("toggles an Entry on a tap while selecting, instead of opening it", async () => {
    const { onSelect, onToggle } = open(["Toast"]);

    await userEvent.click(screen.getByRole("button", { name: /Rice/ }));

    expect(onToggle).toHaveBeenCalledWith(rice);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("tells assistive technology which Entries are selected", () => {
    open(["Toast"]);

    expect(screen.getByRole("button", { name: /Toast/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Rice/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("says nothing about selection when it is not on", () => {
    open();

    expect(screen.getByRole("button", { name: /Toast/ })).not.toHaveAttribute(
      "aria-pressed",
    );
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

describe("DailyTotal on a planned Day", () => {
  it("calls itself the planned total, to everyone", () => {
    render(<DailyTotal entries={[entry("Toast", 2, 110)]} planned />);

    const total = screen.getByRole("region", { name: "Planned total" });
    expect(total).toHaveTextContent("220");
    expect(total).toHaveTextContent("Planned");
    expect(
      screen.queryByRole("region", { name: "Daily total" }),
    ).not.toBeInTheDocument();
  });

  it("still shows progress towards the Goal", () => {
    render(
      <DailyTotal entries={[entry("Feast", 1, 1840)]} goal={2200} planned />,
    );

    expect(
      screen.getByRole("region", { name: "Planned total" }),
    ).toHaveTextContent("360 left");
  });

  it("is a plain Daily total otherwise", () => {
    render(<DailyTotal entries={[entry("Toast", 2, 110)]} />);

    expect(
      screen.getByRole("region", { name: "Daily total" }),
    ).not.toHaveTextContent("Planned");
  });
});

describe("DailyTotal with a Goal", () => {
  const feast = (calories: number) => [entry("Feast", 1, calories)];
  const region = () => screen.getByRole("region", { name: "Daily total" });

  it("shows the total against the Goal, with how much is left", () => {
    render(<DailyTotal entries={feast(1840)} goal={2200} />);

    expect(region()).toHaveTextContent("1,840 / 2,200");
    expect(region()).toHaveTextContent("360 left");
  });

  it("describes progress to assistive technology", () => {
    render(<DailyTotal entries={feast(1100)} goal={2200} />);

    const bar = screen.getByRole("progressbar", {
      name: "Progress towards your daily goal",
    });
    expect(bar).toHaveAttribute("aria-valuenow", "1100");
    expect(bar).toHaveAttribute("aria-valuemax", "2200");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
  });

  it("is full, but not over, exactly on the Goal", () => {
    render(<DailyTotal entries={feast(2200)} goal={2200} />);

    expect(region()).toHaveTextContent("0 left");
    expect(region()).not.toHaveTextContent("over");
    expect(region().querySelector("[data-over]")).toBeNull();
  });

  it("flags a Day over the Goal, by how much, and keeps the bar full", () => {
    render(<DailyTotal entries={feast(2500)} goal={2200} />);

    expect(region()).toHaveTextContent("2,500 / 2,200");
    expect(region()).toHaveTextContent("300 over");
    expect(region().querySelector("[data-over]")).not.toBeNull();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "2200",
    );
  });

  it("shows only the total when there is no Goal", () => {
    render(<DailyTotal entries={feast(1840)} goal={null} />);

    expect(region()).toHaveTextContent("1,840");
    expect(region()).not.toHaveTextContent("/");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("is unchanged when no Goal is passed at all", () => {
    render(<DailyTotal entries={feast(1840)} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
