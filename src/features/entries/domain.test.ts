import { describe, expect, it } from "vitest";
import {
  addedMessage,
  dailyTotal,
  entryCalories,
  formatEntryDetail,
  formatQuantity,
  QUANTITY_STEP,
  removedEntriesMessage,
  stepQuantity,
} from "./domain";
import type { Entry } from "./types";

const entry = (
  quantity: number,
  calories: number,
  portion = "1 slice",
): Entry => ({
  id: crypto.randomUUID(),
  day: "2026-11-03",
  quantity,
  createdAt: "2026-11-03T08:00:00Z",
  food: { id: "f", name: "Toast", portion, calories },
});

describe("formatQuantity", () => {
  it.each([
    [0.5, "½"],
    [1, "1"],
    [1.5, "1½"],
    [2, "2"],
    [2.5, "2½"],
    [10, "10"],
    [20, "20"],
  ])("writes %s as %s", (quantity, text) => {
    expect(formatQuantity(quantity)).toBe(text);
  });
});

describe("entryCalories", () => {
  it("multiplies the Quantity by the Food's current calories", () => {
    expect(entryCalories(entry(1.5, 110))).toBe(165);
    expect(entryCalories(entry(1, 0))).toBe(0);
    expect(entryCalories(entry(20, 9999))).toBe(199980);
  });

  it("rounds a half up to a whole number", () => {
    expect(entryCalories(entry(0.5, 55))).toBe(28);
  });
});

describe("dailyTotal", () => {
  it("is zero for a Day with no Entries", () => {
    expect(dailyTotal([])).toBe(0);
  });

  it("adds up Quantity times calories across Entries", () => {
    expect(dailyTotal([entry(1.5, 110), entry(2, 130), entry(1, 95)])).toBe(
      165 + 260 + 95,
    );
  });

  it("rounds the exact sum once, so halves do not drift", () => {
    // Two half-portions of a 55 kcal Food are 55 kcal, not 28 + 28.
    expect(dailyTotal([entry(0.5, 55), entry(0.5, 55)])).toBe(55);
  });

  it("counts Entries whose Food has since been archived", () => {
    const archived: Entry = {
      ...entry(1, 300),
      food: { id: "pie", name: "Pie", portion: "1 slice", calories: 300 },
    };
    expect(dailyTotal([archived, entry(1, 100)])).toBe(400);
  });
});

describe("formatEntryDetail", () => {
  it("shows Quantity × Portion and the calories", () => {
    expect(formatEntryDetail(entry(1.5, 110))).toBe("1½ × 1 slice · 165 kcal");
    expect(formatEntryDetail(entry(1, 250, "100 g"))).toBe(
      "1 × 100 g · 250 kcal",
    );
  });

  it("uses thousands separators", () => {
    expect(formatEntryDetail(entry(10, 150, "1 cup"))).toBe(
      "10 × 1 cup · 1,500 kcal",
    );
  });
});

describe("stepQuantity", () => {
  it("moves in half-portion steps", () => {
    expect(QUANTITY_STEP).toBe(0.5);
    expect(stepQuantity(1, 1)).toBe(1.5);
    expect(stepQuantity(1, -1)).toBe(0.5);
  });

  it("stops at half a portion and at 20", () => {
    expect(stepQuantity(0.5, -1)).toBe(0.5);
    expect(stepQuantity(20, 1)).toBe(20);
    expect(stepQuantity(19.5, 1)).toBe(20);
  });
});

describe("addedMessage", () => {
  const today = "2026-11-03";

  it("says a Food was added when the Day is today or earlier", () => {
    expect(addedMessage("Sourdough toast", 1.5, "2026-11-03", today)).toBe(
      "Added 1½ × Sourdough toast",
    );
    expect(addedMessage("Sourdough toast", 1, "2026-11-02", today)).toBe(
      "Added 1 × Sourdough toast",
    );
  });

  it("says it was planned, and for when, when the Day is ahead", () => {
    expect(addedMessage("Sourdough toast", 1.5, "2026-11-04", today)).toBe(
      "Planned 1½ × Sourdough toast for tomorrow",
    );
    expect(addedMessage("Sourdough toast", 1.5, "2026-11-06", today)).toBe(
      "Planned 1½ × Sourdough toast for Fri 6 Nov",
    );
  });
});

describe("removedEntriesMessage", () => {
  it("counts the Entries removed", () => {
    expect(removedEntriesMessage(4)).toBe("Removed 4 entries");
    expect(removedEntriesMessage(1)).toBe("Removed 1 entry");
  });
});
