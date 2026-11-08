import { describe, expect, it } from "vitest";
import { MID_RANGE_PHONE, nextThrottleRate } from "./phone";

describe("nextThrottleRate", () => {
  it("slows a fast machine down to the phone", () => {
    // A desktop that scores 2,000 needs 5x to score 400.
    expect(nextThrottleRate(1, 2000)).toBeCloseTo(2000 / MID_RANGE_PHONE);
  });

  it("throttles a slower runner less, so both emulate the same phone", () => {
    const devMachine = nextThrottleRate(1, 2400);
    const ciRunner = nextThrottleRate(1, 1200);

    expect(ciRunner).toBeCloseTo(devMachine / 2);
    expect(2400 / devMachine).toBeCloseTo(1200 / ciRunner);
  });

  it("corrects a rate that missed, in proportion to the miss", () => {
    // 4x left the browser at 300, slower than the phone, so ease off to 3x.
    expect(nextThrottleRate(4, 300)).toBeCloseTo(3);
    // 2x left it at 800, twice as fast as the phone, so double it.
    expect(nextThrottleRate(2, 800)).toBeCloseTo(4);
  });

  it("never speeds up a machine already slower than the phone", () => {
    expect(nextThrottleRate(1, 250)).toBe(1);
    expect(nextThrottleRate(1.5, 200)).toBe(1);
  });
});
