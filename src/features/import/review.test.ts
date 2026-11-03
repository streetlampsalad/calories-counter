import { describe, expect, it } from "vitest";
import type { Food } from "@/features/foods/types";
import type { ImportRow } from "./parse";
import {
  checkRow,
  importPayload,
  importToast,
  initialReview,
  keptCount,
  planCounts,
  planFor,
  type ReviewRow,
  restoreReview,
  reviewReducer,
  reviewRows,
} from "./review";

const row = (over: Partial<ImportRow> = {}): ImportRow => ({
  name: "Banana",
  portion: "1 medium",
  calories: "105",
  kilojoules: "",
  ...over,
});
let next = 0;
const ids = () => `row-${++next}`;
const load = (rows: ImportRow[]) =>
  reviewReducer(initialReview, { type: "load", rows: reviewRows(rows, ids) });

describe("reviewRows", () => {
  it("switches valid rows on and invalid rows off (AC-6)", () => {
    const rows = reviewRows(
      [
        row(),
        row({ name: "", calories: "" }),
        row({ name: "Huge", calories: "99999" }),
      ],
      ids,
    );

    expect(rows.map((r) => r.keep)).toEqual([true, false, false]);
  });

  it("gives every row its own id", () => {
    const rows = reviewRows([row(), row({ name: "Rice" })], ids);

    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });
});

describe("reviewReducer", () => {
  it("starts empty", () => {
    expect(initialReview.rows).toEqual([]);
  });

  it("loads rows, replacing any it had", () => {
    const state = load([row({ name: "A" }), row({ name: "B" })]);
    const replaced = reviewReducer(state, {
      type: "load",
      rows: reviewRows([row({ name: "C" })], ids),
    });

    expect(replaced.rows.map((r) => r.name)).toEqual(["C"]);
  });

  it("adds rows after the ones it has (for photo import)", () => {
    const state = load([row({ name: "A" })]);
    const added = reviewReducer(state, {
      type: "add",
      rows: reviewRows([row({ name: "B" })], ids),
    });

    expect(added.rows.map((r) => r.name)).toEqual(["A", "B"]);
  });

  it("edits a field of one row only", () => {
    const state = load([row({ name: "A" }), row({ name: "B" })]);
    const [first, second] = state.rows;

    const edited = reviewReducer(state, {
      type: "edit",
      id: first.id,
      field: "portion",
      value: "2 slices",
    });

    expect(edited.rows[0].portion).toBe("2 slices");
    expect(edited.rows[1]).toEqual(second);
  });

  it("switches a flagged row on once an edit makes it valid (AC-6)", () => {
    const state = load([row({ calories: "" })]);
    const { id } = state.rows[0];
    expect(state.rows[0].keep).toBe(false);

    const fixed = reviewReducer(state, {
      type: "edit",
      id,
      field: "calories",
      value: "105",
    });

    expect(fixed.rows[0].keep).toBe(true);
  });

  it("keeps a row off while it is still invalid", () => {
    const state = load([row({ name: "", calories: "" })]);
    const { id } = state.rows[0];

    const partial = reviewReducer(state, {
      type: "edit",
      id,
      field: "calories",
      value: "105",
    });

    expect(partial.rows[0].keep).toBe(false);
  });

  it("switches a row off if an edit makes it invalid", () => {
    const state = load([row()]);
    const { id } = state.rows[0];

    const broken = reviewReducer(state, {
      type: "edit",
      id,
      field: "calories",
      value: "lots",
    });

    expect(broken.rows[0].keep).toBe(false);
  });

  it("does not switch a row back on that the User switched off, when they edit it", () => {
    let state = load([row()]);
    const { id } = state.rows[0];
    state = reviewReducer(state, { type: "toggle", id });
    expect(state.rows[0].keep).toBe(false);

    state = reviewReducer(state, {
      type: "edit",
      id,
      field: "portion",
      value: "1 large",
    });

    expect(state.rows[0].keep).toBe(false);
  });

  it("toggles a valid row", () => {
    const state = load([row()]);
    const { id } = state.rows[0];

    const off = reviewReducer(state, { type: "toggle", id });
    const on = reviewReducer(off, { type: "toggle", id });

    expect([off.rows[0].keep, on.rows[0].keep]).toEqual([false, true]);
  });

  it("will not switch on a row that is invalid", () => {
    const state = load([row({ calories: "" })]);

    const toggled = reviewReducer(state, {
      type: "toggle",
      id: state.rows[0].id,
    });

    expect(toggled.rows[0].keep).toBe(false);
  });

  it("ignores an edit or toggle for a row it does not have", () => {
    const state = load([row()]);

    expect(
      reviewReducer(state, {
        type: "edit",
        id: "nope",
        field: "name",
        value: "x",
      }),
    ).toEqual(state);
    expect(reviewReducer(state, { type: "toggle", id: "nope" })).toEqual(state);
  });

  it("resets to empty", () => {
    expect(reviewReducer(load([row()]), { type: "reset" })).toEqual(
      initialReview,
    );
  });

  it("restores a saved state", () => {
    const saved = load([row()]);

    expect(
      reviewReducer(initialReview, { type: "restore", state: saved }),
    ).toEqual(saved);
  });
});

describe("checkRow and keptCount", () => {
  it("checks a row with the import rules, including kilojoules", () => {
    const converted: ReviewRow = {
      id: "x",
      keep: true,
      onDuplicate: "skip",
      merged: 0,
      alsoListed: [],
      ...row({ calories: "", kilojoules: "1000" }),
    };

    expect(checkRow(converted)).toMatchObject({
      ok: true,
      value: { calories: 239, fromKilojoules: 1000 },
    });
  });

  it("counts the rows that are switched on", () => {
    const state = load([
      row(),
      row({ name: "Rice" }),
      row({ name: "", calories: "" }),
    ]);

    expect(keptCount(state)).toBe(2);
    expect(
      keptCount(reviewReducer(state, { type: "toggle", id: state.rows[0].id })),
    ).toBe(1);
  });
});

describe("editing a converted row", () => {
  it("drops the kilojoules once calories are typed, so clearing stays cleared", () => {
    const state = load([row({ calories: "", kilojoules: "1000" })]);
    const { id } = state.rows[0];

    const typed = reviewReducer(state, {
      type: "edit",
      id,
      field: "calories",
      value: "250",
    });
    const cleared = reviewReducer(typed, {
      type: "edit",
      id,
      field: "calories",
      value: "",
    });

    expect(typed.rows[0].kilojoules).toBe("");
    expect(cleared.rows[0].keep).toBe(false);
    expect(checkRow(cleared.rows[0])).toMatchObject({ ok: false });
  });
});

describe("restoreReview", () => {
  it("reads back what was saved", () => {
    const saved = load([row()]);

    expect(restoreReview(JSON.stringify(saved))).toEqual(saved);
  });

  it("gives null for nothing, nonsense or the wrong shape", () => {
    expect(restoreReview(null)).toBeNull();
    expect(restoreReview("")).toBeNull();
    expect(restoreReview("{not json")).toBeNull();
    expect(restoreReview("[]")).toBeNull();
    expect(restoreReview('{"rows":[{"name":"x"}]}')).toBeNull();
    expect(restoreReview('{"rows":"x"}')).toBeNull();
  });
});

const food = (over: Partial<Food> = {}): Food => ({
  id: "food-1",
  name: "Banana",
  portion: "1 medium",
  calories: 90,
  archivedAt: null,
  ...over,
});

describe("merging identical rows (AC-7)", () => {
  it("merges two rows with the same name, portion and calories into one", () => {
    const rows = reviewRows([row(), row()], ids);

    expect(rows).toHaveLength(1);
    expect(rows[0].merged).toBe(1);
    expect(rows[0].alsoListed).toEqual([]);
  });

  it("ignores case and spacing when matching", () => {
    const rows = reviewRows(
      [
        row({ name: "Banana" }),
        row({ name: "  banana ", portion: "1  MEDIUM" }),
      ],
      ids,
    );

    expect(rows).toHaveLength(1);
  });

  it("keeps the first row and notes a different value the other one gave", () => {
    const rows = reviewRows(
      [row({ calories: "105" }), row({ calories: "110" })],
      ids,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].calories).toBe("105");
    expect(rows[0].alsoListed).toEqual(["110 kcal"]);
  });

  it("counts every row merged into one", () => {
    expect(reviewRows([row(), row(), row()], ids)[0].merged).toBe(2);
  });

  it("does not merge rows with different portions or names", () => {
    expect(
      reviewRows(
        [row(), row({ portion: "1 large" }), row({ name: "Rice" })],
        ids,
      ),
    ).toHaveLength(3);
  });

  it("does not merge rows that have no name or portion yet", () => {
    expect(
      reviewRows([row({ name: "" }), row({ name: "" })], ids),
    ).toHaveLength(2);
  });

  it("merges rows added later into the rows already there", () => {
    const state = load([row()]);

    const added = reviewReducer(state, {
      type: "add",
      rows: reviewRows([row({ name: "Rice" }), row()], ids),
    });

    expect(added.rows.map((r) => r.name)).toEqual(["Banana", "Rice"]);
    expect(added.rows[0].merged).toBe(1);
  });
});

describe("planFor (AC-7)", () => {
  it("adds a valid row that is new", () => {
    const state = load([row({ name: "Rice" })]);

    expect(planFor(state.rows[0], [food()])).toEqual({ kind: "add" });
  });

  it("skips a row already in the Food List by default, naming the Food", () => {
    const state = load([row()]);

    expect(state.rows[0].onDuplicate).toBe("skip");
    expect(planFor(state.rows[0], [food()])).toEqual({
      kind: "skip",
      existing: food(),
    });
  });

  it("updates the existing Food when asked", () => {
    let state = load([row()]);
    state = reviewReducer(state, {
      type: "duplicate",
      id: state.rows[0].id,
      action: "update",
    });

    expect(planFor(state.rows[0], [food()])).toEqual({
      kind: "update",
      existing: food(),
    });
  });

  it("matches the name and portion without regard to case or spacing", () => {
    const state = load([row({ name: " BANANA ", portion: "1 Medium" })]);

    expect(planFor(state.rows[0], [food()]).kind).toBe("skip");
  });

  it("ignores Archived Foods, which do not block a new one", () => {
    const state = load([row()]);

    expect(
      planFor(state.rows[0], [food({ archivedAt: "2026-01-01" })]),
    ).toEqual({ kind: "add" });
  });

  it("does nothing with a row that is switched off or flagged", () => {
    const state = load([row(), row({ name: "Rice", calories: "" })]);
    const off = reviewReducer(state, { type: "toggle", id: state.rows[0].id });

    expect(planFor(off.rows[0], [])).toEqual({ kind: "off" });
    expect(planFor(state.rows[1], [])).toEqual({ kind: "off" });
  });

  it("becomes a plain add once an edit makes the row differ from the existing Food", () => {
    let state = load([row()]);
    state = reviewReducer(state, {
      type: "edit",
      id: state.rows[0].id,
      field: "portion",
      value: "1 large",
    });

    expect(planFor(state.rows[0], [food()])).toEqual({ kind: "add" });
  });
});

describe("planCounts", () => {
  it("counts what Save will add and update, and what it leaves out", () => {
    let state = load([
      row({ name: "New" }),
      row({ name: "Also new", portion: "1 piece" }),
      row(),
      row({ name: "Banana", portion: "1 large" }),
      row({ name: "Bad", calories: "" }),
    ]);
    // Banana 1 medium exists; ask to update the row that matches it.
    state = reviewReducer(state, {
      type: "duplicate",
      id: state.rows[2].id,
      action: "update",
    });
    const existing = [
      food(),
      food({ id: "food-2", portion: "1 large", name: "Banana" }),
    ];

    expect(planCounts(state, existing)).toEqual({
      add: 2,
      update: 1,
      skip: 1,
      off: 0,
      flagged: 1,
    });
  });
});

describe("importPayload", () => {
  it("lists new rows to add and chosen duplicates to update, by the existing Food's id", () => {
    let state = load([
      row({ name: "New", portion: "1 piece", calories: "50" }),
      row({ calories: "105" }),
      row({ name: "Rice", portion: "100 g", calories: "130" }),
      row({ name: "Bad", calories: "" }),
    ]);
    state = reviewReducer(state, {
      type: "duplicate",
      id: state.rows[1].id,
      action: "update",
    });
    state = reviewReducer(state, { type: "toggle", id: state.rows[2].id });

    expect(importPayload(state, [food()])).toEqual([
      { name: "New", portion: "1 piece", calories: 50 },
      { id: "food-1", name: "Banana", portion: "1 medium", calories: 105 },
    ]);
  });

  it("leaves out skipped duplicates", () => {
    const state = load([row()]);

    expect(importPayload(state, [food()])).toEqual([]);
  });

  it("sends the converted Calories for a kilojoules row", () => {
    const state = load([
      row({ name: "Choc", calories: "", kilojoules: "1000" }),
    ]);

    expect(importPayload(state, [])).toEqual([
      { name: "Choc", portion: "1 medium", calories: 239 },
    ]);
  });

  it("tidies spacing in the name and portion", () => {
    const state = load([row({ name: " Big   toast ", portion: "2  slices" })]);

    expect(importPayload(state, [])[0]).toMatchObject({
      name: "Big toast",
      portion: "2 slices",
    });
  });
});

describe("importToast", () => {
  it("says what was added and updated, leaving out a zero", () => {
    expect(importToast({ added: 3, updated: 1 })).toBe("Added 3, updated 1");
    expect(importToast({ added: 3, updated: 0 })).toBe("Added 3");
    expect(importToast({ added: 0, updated: 2 })).toBe("Updated 2");
    expect(importToast({ added: 0, updated: 0 })).toBe("Nothing to save");
  });
});
