import { describe, expect, it } from "vitest";
import { removalSummary } from "./domain";
import type { Food } from "./types";

const food = (id: string): Food => ({
  id,
  name: id,
  portion: "1 serve",
  calories: 100,
  archivedAt: null,
});
const foods = (...ids: string[]) => ids.map(food);

describe("removalSummary", () => {
  it("spells out the split when some Foods will be archived and some deleted", () => {
    const summary = removalSummary(foods("a", "b", "c", "d", "e"), {
      a: 4,
      b: 1,
      c: 12,
      d: 0,
    });

    expect(summary).toEqual({
      title: "Remove 5 foods?",
      description: "3 you've logged will be archived, 2 will be deleted.",
      confirmLabel: "Remove 5 foods",
    });
  });

  it("says Archive when every Food has been logged", () => {
    const summary = removalSummary(foods("a", "b", "c"), { a: 1, b: 2, c: 3 });

    expect(summary.title).toBe("Archive 3 foods?");
    expect(summary.confirmLabel).toBe("Archive 3 foods");
    expect(summary.description).toMatch(/past entries/i);
  });

  it("says Delete when no Food has been logged", () => {
    const summary = removalSummary(foods("a", "b"), { a: 0 });

    expect(summary.title).toBe("Delete 2 foods?");
    expect(summary.confirmLabel).toBe("Delete 2 foods");
    expect(summary.description).toMatch(/no entries/i);
  });

  it("treats a Food missing from the counts as never logged", () => {
    expect(removalSummary(foods("a"), {}).title).toBe("Delete 1 food?");
  });

  it("uses the singular for one Food", () => {
    expect(removalSummary(foods("a"), { a: 2 })).toMatchObject({
      title: "Archive 1 food?",
      confirmLabel: "Archive 1 food",
    });
  });

  it("does not guess the split before the counts are known", () => {
    const summary = removalSummary(foods("a", "b", "c", "d"), undefined);

    expect(summary).toEqual({
      title: "Remove 4 foods?",
      description: "Foods you've logged are archived. The rest are deleted.",
      confirmLabel: "Remove 4 foods",
    });
  });
});
