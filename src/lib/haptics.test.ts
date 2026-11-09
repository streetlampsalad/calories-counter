// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canVibrate,
  HAPTIC_PATTERNS,
  haptic,
  isVibrationOn,
  setVibrationOn,
  subscribeVibration,
} from "./haptics";

const vibrate = vi.fn((_pattern: VibratePattern) => true);

function supportVibration(supported: boolean) {
  Object.defineProperty(navigator, "vibrate", {
    configurable: true,
    writable: true,
    value: supported ? vibrate : undefined,
  });
}

beforeEach(() => {
  vibrate.mockClear();
  window.localStorage.clear();
  supportVibration(true);
});
afterEach(() => vi.restoreAllMocks());

describe("haptic", () => {
  it("gives a brief buzz for a tap, a firmer one to confirm, and a double pulse for an error", () => {
    expect(HAPTIC_PATTERNS).toEqual({
      tap: 10,
      confirm: 30,
      error: [30, 60, 30],
    });

    haptic("tap");
    haptic("confirm");
    haptic("error");

    expect(vibrate.mock.calls).toEqual([[10], [30], [[30, 60, 30]]]);
  });

  it("is on until the User turns it off", () => {
    expect(isVibrationOn()).toBe(true);

    haptic("tap");

    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("does nothing when switched off, and works again when switched back on", () => {
    setVibrationOn(false);
    haptic("tap");
    expect(vibrate).not.toHaveBeenCalled();

    setVibrationOn(true);
    haptic("tap");
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("does nothing, quietly, on a device that cannot vibrate", () => {
    supportVibration(false);

    expect(canVibrate()).toBe(false);
    expect(() => haptic("error")).not.toThrow();
  });

  it("stays on, and does not fail, when the browser will not let it read the setting", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(isVibrationOn()).toBe(true);
    expect(() => haptic("tap")).not.toThrow();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("does not fail when the browser will not let it save the setting", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => setVibrationOn(false)).not.toThrow();
  });
});

describe("the Vibration setting", () => {
  it("is remembered on this device", () => {
    setVibrationOn(false);

    expect(isVibrationOn()).toBe(false);
    expect(window.localStorage.getItem("vibration")).toBe("off");

    setVibrationOn(true);
    expect(isVibrationOn()).toBe(true);
  });

  it("tells anyone listening when it changes, and stops when they stop", () => {
    const listener = vi.fn();
    const stop = subscribeVibration(listener);

    setVibrationOn(false);
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    setVibrationOn(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
