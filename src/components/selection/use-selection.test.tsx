import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSelection } from "./use-selection";

describe("useSelection", () => {
  let pushState: ReturnType<typeof vi.spyOn>;
  let back: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pushState = vi.spyOn(window.history, "pushState");
    // jsdom's back() is asynchronous; the tests send the popstate themselves.
    back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("starts out not selecting", () => {
    const { result } = renderHook(() => useSelection());

    expect(result.current.selecting).toBe(false);
    expect(result.current.count).toBe(0);
    expect(pushState).not.toHaveBeenCalled();
  });

  it("starts with one item selected", () => {
    const { result } = renderHook(() => useSelection());

    act(() => result.current.start("a"));

    expect(result.current.selecting).toBe(true);
    expect(result.current.count).toBe(1);
    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.isSelected("b")).toBe(false);
  });

  it("toggles items, and selects all", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.start("a"));

    act(() => result.current.toggle("b"));
    expect(result.current.count).toBe(2);
    act(() => result.current.toggle("a"));
    expect(result.current.isSelected("a")).toBe(false);
    act(() => result.current.selectAll(["a", "b", "c"]));
    expect(result.current.count).toBe(3);
  });

  it("adds one history entry when selection starts, not one per tap", () => {
    const { result } = renderHook(() => useSelection());

    act(() => result.current.start("a"));
    act(() => result.current.toggle("b"));
    act(() => result.current.toggle("c"));

    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it("ends when the phone's back is pressed, without going further back", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.start("a"));

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current.selecting).toBe(false);
    expect(back).not.toHaveBeenCalled();
  });

  it("gives its history entry back when cleared", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.start("a"));

    act(() => result.current.clear());

    expect(result.current.selecting).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("gives its history entry back when the last item is deselected", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.start("a"));

    act(() => result.current.toggle("a"));

    expect(result.current.selecting).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("can select again after the phone's back", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.start("a"));
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    act(() => result.current.start("b"));

    expect(result.current.isSelected("b")).toBe(true);
    expect(pushState).toHaveBeenCalledTimes(2);
  });

  it("does not undo a navigation when the screen goes away mid-selection", () => {
    const { result, unmount } = renderHook(() => useSelection());
    act(() => result.current.start("a"));

    unmount();

    expect(back).not.toHaveBeenCalled();
  });
});
