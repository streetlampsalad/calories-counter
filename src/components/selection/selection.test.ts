import { describe, expect, it } from "vitest";
import {
  isSelecting,
  noSelection,
  selectAll,
  startSelection,
  toggleSelected,
} from "./selection";

describe("selection", () => {
  it("is not selecting until something is selected", () => {
    expect(isSelecting(noSelection)).toBe(false);
    expect(isSelecting(startSelection("a"))).toBe(true);
  });

  it("starts with the held item alone", () => {
    expect([...startSelection("a")]).toEqual(["a"]);
  });

  it("toggles an item in and out", () => {
    const one = startSelection("a");
    const two = toggleSelected(one, "b");
    expect([...two]).toEqual(["a", "b"]);
    expect([...toggleSelected(two, "a")]).toEqual(["b"]);
  });

  it("ends when the last item is deselected", () => {
    const left = toggleSelected(startSelection("a"), "a");
    expect(isSelecting(left)).toBe(false);
  });

  it("never changes the selection it was given", () => {
    const one = startSelection("a");
    toggleSelected(one, "b");
    expect([...one]).toEqual(["a"]);
  });

  it("selects every id it is given", () => {
    expect([...selectAll(["a", "b", "c"])]).toEqual(["a", "b", "c"]);
  });

  it("selecting all of nothing is not selecting", () => {
    expect(isSelecting(selectAll([]))).toBe(false);
  });
});
