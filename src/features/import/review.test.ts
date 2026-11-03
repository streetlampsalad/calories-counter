import { describe, expect, it } from "vitest";
import type { ImportRow } from "./parse";
import {
  checkRow,
  initialReview,
  keptCount,
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
      [row(), row({ name: "", calories: "" }), row({ calories: "99999" })],
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
