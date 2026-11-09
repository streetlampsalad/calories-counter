// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COUNT_MS, tweenValue, useAnimatedNumber } from "./animated-number";

describe("tweenValue (AC-3)", () => {
  it("starts at where it was", () => {
    expect(tweenValue(100, 300, 0, 400)).toBe(100);
  });

  it("ends exactly on where it is going, at the end and after it", () => {
    expect(tweenValue(100, 300, 400, 400)).toBe(300);
    expect(tweenValue(100, 300, 9999, 400)).toBe(300);
  });

  it("eases out: more than half-way by half the time", () => {
    const middle = tweenValue(0, 1000, 200, 400);
    expect(middle).toBeGreaterThan(500);
    expect(middle).toBeLessThan(1000);
  });

  it("only ever moves towards its target, up", () => {
    let last = 100;
    for (let t = 0; t <= 400; t += 16) {
      const value = tweenValue(100, 900, t, 400);
      expect(value).toBeGreaterThanOrEqual(last);
      expect(value).toBeLessThanOrEqual(900);
      last = value;
    }
  });

  it("only ever moves towards its target, down", () => {
    let last = 900;
    for (let t = 0; t <= 400; t += 16) {
      const value = tweenValue(900, 100, t, 400);
      expect(value).toBeLessThanOrEqual(last);
      expect(value).toBeGreaterThanOrEqual(100);
      last = value;
    }
  });

  it("gives whole numbers", () => {
    for (let t = 0; t <= 400; t += 7) {
      expect(Number.isInteger(tweenValue(0, 333, t, 400))).toBe(true);
    }
  });

  it("stays put when there is nowhere to go", () => {
    expect(tweenValue(250, 250, 120, 400)).toBe(250);
  });

  it("treats time before the start as the start", () => {
    expect(tweenValue(100, 300, -16, 400)).toBe(100);
  });

  it("jumps when there is no time to take", () => {
    expect(tweenValue(100, 300, 0, 0)).toBe(300);
  });
});

describe("useAnimatedNumber", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
    }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const run = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it("starts on the value it is given, with no counting (AC-4)", () => {
    const { result } = renderHook(() => useAnimatedNumber(1840));

    expect(result.current).toBe(1840);
  });

  it("counts up to a new value, passing through numbers between, and stops exactly on it (AC-3)", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useAnimatedNumber(value),
      { initialProps: { value: 1000 } },
    );

    rerender({ value: 1500 });
    expect(result.current).toBe(1000);
    run(160);
    expect(result.current).toBeGreaterThan(1000);
    expect(result.current).toBeLessThan(1500);
    run(COUNT_MS);
    expect(result.current).toBe(1500);
  });

  it("counts down as well (AC-3)", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useAnimatedNumber(value),
      { initialProps: { value: 1500 } },
    );

    rerender({ value: 1000 });
    run(160);
    expect(result.current).toBeLessThan(1500);
    expect(result.current).toBeGreaterThan(1000);
    run(COUNT_MS);
    expect(result.current).toBe(1000);
  });

  it("carries on from the figure on screen when the value changes mid-count (AC-3)", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useAnimatedNumber(value),
      { initialProps: { value: 0 } },
    );
    rerender({ value: 1000 });
    run(160);
    const midway = result.current;
    expect(midway).toBeGreaterThan(0);

    rerender({ value: 0 });
    run(16);

    // Heading back down from where it had got to, not jumping to 1,000 or to 0.
    expect(result.current).toBeLessThanOrEqual(midway);
    expect(result.current).toBeGreaterThan(0);
    run(COUNT_MS);
    expect(result.current).toBe(0);
  });

  it("jumps, never counts, when the key changes with the value (AC-4)", () => {
    const { result, rerender } = renderHook(
      ({ value, day }) => useAnimatedNumber(value, { resetKey: day }),
      { initialProps: { value: 1000, day: "2026-11-03" } },
    );

    rerender({ value: 2400, day: "2026-11-04" });

    expect(result.current).toBe(2400);
    run(COUNT_MS);
    expect(result.current).toBe(2400);
  });

  it("counts again for a change on the same key after a jump", () => {
    const { result, rerender } = renderHook(
      ({ value, day }) => useAnimatedNumber(value, { resetKey: day }),
      { initialProps: { value: 1000, day: "2026-11-03" } },
    );
    rerender({ value: 2400, day: "2026-11-04" });

    rerender({ value: 2500, day: "2026-11-04" });
    run(80);

    expect(result.current).toBeGreaterThan(2400);
    expect(result.current).toBeLessThan(2500);
  });

  it("jumps when the device asks for reduced motion (AC-8)", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
    }));
    const { result, rerender } = renderHook(
      ({ value }) => useAnimatedNumber(value),
      { initialProps: { value: 1000 } },
    );

    rerender({ value: 1500 });

    expect(result.current).toBe(1500);
  });

  it("stops counting when it goes away", () => {
    const cancel = vi.spyOn(globalThis, "cancelAnimationFrame");
    const { rerender, unmount } = renderHook(
      ({ value }) => useAnimatedNumber(value),
      { initialProps: { value: 1000 } },
    );
    rerender({ value: 1500 });

    unmount();

    expect(cancel).toHaveBeenCalled();
  });
});
