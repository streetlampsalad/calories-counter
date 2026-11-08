import type { CDPSession, Page } from "@playwright/test";

// Emulates the CPU of a mid-range Android phone, whatever machine the test runs on.
//
// A fixed slowdown ("4x slower than this machine") emulates a different phone on every machine: a
// shared CI runner is already slower than a dev laptop, so 4x of it is slower than the phone a
// promise such as spec 011's AC-8 describes (#134). Instead, this measures how fast the browser
// is and picks the slowdown that brings it to the phone's speed, as Chrome DevTools' calibrated
// "Mid-tier mobile" preset does.
//
// Speed is Lighthouse's BenchmarkIndex, measured the way Lighthouse measures it. Lighthouse puts a
// mid-tier mobile phone at 125-800, and its default 4x is meant to bring a typical high-end
// desktop (1,500-2,000) into that range, so the phone here scores 400.
// https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md
export const MID_RANGE_PHONE = 400;

// Within 10% of the phone is close enough: one measurement varies about that much on its own.
const TOLERANCE = 0.1;
const MAX_CORRECTIONS = 3;

/**
 * The CPU slowdown to try next, given the score the browser measured at the current one. The
 * score falls in proportion to the slowdown, so the correction is proportional too. A machine
 * already slower than the phone is left at full speed (1x), since throttling cannot speed it up.
 */
export function nextThrottleRate(
  rate: number,
  measured: number,
  target = MID_RANGE_PHONE,
) {
  return Math.max(1, (rate * measured) / target);
}

// Lighthouse's computeBenchmarkIndex (core/lib/page-functions.js, Apache-2.0), unchanged: a
// string-building loop and an array-copying loop, each run for 500 ms, averaged.
function computeBenchmarkIndex() {
  function benchmarkIndexGC() {
    const start = Date.now();
    let iterations = 0;
    while (Date.now() - start < 500) {
      let s = "";
      for (let j = 0; j < 10000; j++) s += "a";
      if (s.length === 1) throw new Error("prevents compiler optimizations");
      iterations++;
    }
    const durationInSeconds = (Date.now() - start) / 1000;
    return Math.round(iterations / 10 / durationInSeconds);
  }

  function benchmarkIndexNoGC() {
    const arrA: number[] = [];
    const arrB: number[] = [];
    for (let i = 0; i < 100000; i++) {
      arrA[i] = i;
      arrB[i] = i;
    }
    const start = Date.now();
    let iterations = 0;
    while (iterations % 10 !== 0 || Date.now() - start < 500) {
      const src = iterations % 2 === 0 ? arrA : arrB;
      const tgt = iterations % 2 === 0 ? arrB : arrA;
      for (let j = 0; j < src.length; j++) tgt[j] = src[j];
      iterations++;
    }
    const durationInSeconds = (Date.now() - start) / 1000;
    return Math.round(iterations / 10 / durationInSeconds);
  }

  return (benchmarkIndexGC() + benchmarkIndexNoGC()) / 2;
}

export type PhoneCpu = {
  /** The browser's score at full speed. */
  machine: number;
  /** The slowdown applied. */
  rate: number;
  /** The browser's score at that slowdown: the phone's speed, unless the machine is slower. */
  measured: number;
};

/**
 * Throttles the page's CPU until it scores like a mid-range phone, and reports what it found.
 * Run it on a page that has finished loading, so the app's own work does not skew the score.
 */
export async function emulateMidRangePhoneCpu(
  page: Page,
  cdp: CDPSession,
): Promise<PhoneCpu> {
  const benchmark = () => page.evaluate(computeBenchmarkIndex);
  const setRate = (rate: number) =>
    cdp.send("Emulation.setCPUThrottlingRate", { rate });

  const closeEnough = (score: number) =>
    Math.abs(score - MID_RANGE_PHONE) / MID_RANGE_PHONE <= TOLERANCE;

  await setRate(1);
  const machine = await benchmark();
  let rate = 1;
  let measured = machine;
  for (let i = 0; i < MAX_CORRECTIONS && !closeEnough(measured); i++) {
    const next = nextThrottleRate(rate, measured);
    if (next === rate) break; // already at full speed on a machine slower than the phone
    rate = next;
    await setRate(rate);
    measured = await benchmark();
  }
  return { machine, rate, measured };
}
