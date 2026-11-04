import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type EntryRowState,
  LEAVE_MS,
  reconcileRows,
  useEntryRows,
} from "./entry-rows";
import type { Entry } from "./types";

const entry = (id: string): Entry => ({
  id,
  day: "2026-11-03",
  quantity: 1,
  createdAt: "2026-11-03T08:00:00Z",
  food: { id: `food-${id}`, name: id, portion: "1 slice", calories: 100 },
});

const settled = (...ids: string[]): EntryRowState[] =>
  ids.map((id) => ({ entry: entry(id), leaving: false, animate: false }));
const ids = (rows: readonly EntryRowState[]) =>
  rows.map((row) => `${row.entry.id}${row.leaving ? "*" : ""}`);

describe("reconcileRows", () => {
  it("keeps Entries that are still there as they were, with nothing animating", () => {
    const rows = reconcileRows(
      settled("a", "b"),
      [entry("a"), entry("b")],
      true,
    );

    expect(ids(rows)).toEqual(["a", "b"]);
    expect(rows.every((row) => !row.animate && !row.leaving)).toBe(true);
  });

  it("marks an Entry that is new to the list to slide in (AC-7)", () => {
    const rows = reconcileRows(settled("a"), [entry("b"), entry("a")], true);

    expect(ids(rows)).toEqual(["b", "a"]);
    expect(rows[0].animate).toBe(true);
    expect(rows[1].animate).toBe(false);
  });

  it("keeps a removed Entry where it was, marked leaving (AC-7)", () => {
    const rows = reconcileRows(
      settled("a", "b", "c"),
      [entry("a"), entry("c")],
      true,
    );

    expect(ids(rows)).toEqual(["a", "b*", "c"]);
  });

  it("keeps a removed first Entry first, and a removed last Entry last", () => {
    expect(ids(reconcileRows(settled("a", "b"), [entry("b")], true))).toEqual([
      "a*",
      "b",
    ]);
    expect(ids(reconcileRows(settled("a", "b"), [entry("a")], true))).toEqual([
      "a",
      "b*",
    ]);
  });

  it("keeps several removed Entries in their order", () => {
    const rows = reconcileRows(
      settled("a", "b", "c", "d"),
      [entry("a"), entry("d")],
      true,
    );

    expect(ids(rows)).toEqual(["a", "b*", "c*", "d"]);
  });

  it("keeps every Entry leaving when the Day is emptied", () => {
    const rows = reconcileRows(settled("a", "b"), [], true);

    expect(ids(rows)).toEqual(["a*", "b*"]);
  });

  it("keeps an Entry that was already leaving, until it is dropped", () => {
    const leaving = reconcileRows(settled("a", "b"), [entry("a")], true);

    const again = reconcileRows(leaving, [entry("a"), entry("c")], true);

    expect(ids(again)).toEqual(["a", "b*", "c"]);
  });

  it("brings a leaving Entry back when it returns, without animating it in again", () => {
    const leaving = reconcileRows(settled("a", "b"), [entry("a")], true);

    const back = reconcileRows(leaving, [entry("a"), entry("b")], true);

    expect(ids(back)).toEqual(["a", "b"]);
    expect(back[1].leaving).toBe(false);
    expect(back[1].animate).toBe(false);
  });

  it("drops removed Entries at once when asked not to keep them (AC-8)", () => {
    const rows = reconcileRows(settled("a", "b"), [entry("a")], false);

    expect(ids(rows)).toEqual(["a"]);
  });

  it("takes the new version of an Entry that changed", () => {
    const changed = { ...entry("a"), quantity: 3 };

    const rows = reconcileRows(settled("a"), [changed], true);

    expect(rows[0].entry.quantity).toBe(3);
    expect(rows[0].animate).toBe(false);
  });
});

describe("useEntryRows", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
    }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts with every Entry settled, so opening a Day animates nothing (AC-7)", () => {
    const { result } = renderHook(() => useEntryRows([entry("a"), entry("b")]));

    expect(ids(result.current)).toEqual(["a", "b"]);
    expect(result.current.some((row) => row.animate)).toBe(false);
  });

  it("keeps a removed Entry for the collapse, then drops it (AC-7)", () => {
    const first = [entry("a"), entry("b")];
    const { result, rerender } = renderHook(
      ({ entries }) => useEntryRows(entries),
      { initialProps: { entries: first } },
    );

    rerender({ entries: [first[0]] });
    expect(ids(result.current)).toEqual(["a", "b*"]);

    act(() => void vi.advanceTimersByTime(LEAVE_MS - 1));
    expect(ids(result.current)).toEqual(["a", "b*"]);
    act(() => void vi.advanceTimersByTime(2));
    expect(ids(result.current)).toEqual(["a"]);
  });

  it("drops a removed Entry at once for a device that asks for reduced motion (AC-8)", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
    }));
    const first = [entry("a"), entry("b")];
    const { result, rerender } = renderHook(
      ({ entries }) => useEntryRows(entries),
      { initialProps: { entries: first } },
    );

    rerender({ entries: [first[0]] });

    expect(ids(result.current)).toEqual(["a"]);
  });

  it("marks an added Entry to slide in (AC-7)", () => {
    const first = [entry("a")];
    const { result, rerender } = renderHook(
      ({ entries }) => useEntryRows(entries),
      { initialProps: { entries: first } },
    );

    rerender({ entries: [entry("b"), ...first] });

    expect(result.current[0]).toMatchObject({ animate: true, leaving: false });
  });

  it("does not drop a row early when another leaves later", () => {
    const first = [entry("a"), entry("b"), entry("c")];
    const { result, rerender } = renderHook(
      ({ entries }) => useEntryRows(entries),
      { initialProps: { entries: first } },
    );
    rerender({ entries: [first[0], first[2]] });
    act(() => void vi.advanceTimersByTime(100));

    rerender({ entries: [first[0]] });
    expect(ids(result.current)).toEqual(["a", "b*", "c*"]);

    act(() => void vi.advanceTimersByTime(LEAVE_MS + 1));
    expect(ids(result.current)).toEqual(["a"]);
  });

  it("clears its timer when it goes away", () => {
    const first = [entry("a"), entry("b")];
    const { rerender, unmount } = renderHook(
      ({ entries }) => useEntryRows(entries),
      { initialProps: { entries: first } },
    );
    rerender({ entries: [first[0]] });

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
