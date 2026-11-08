import type { CDPSession, Page } from "@playwright/test";

// Emulates the CPU of a mid-range Android phone, whatever machine the test runs on.
//
// A fixed slowdown ("4x slower than this machine") emulates a different phone on every machine: a
// shared CI runner is already slower than a dev laptop, so 4x of it is slower than the phone a
// promise such as spec 011's AC-8 describes (#134). Instead, this measures how fast the browser
// is and picks the slowdown that brings it to the phone's speed, as Chrome DevTools' calibrated
// "Mid-tier mobile" preset does.
//
// Speed is Lighthouse's BenchmarkIndex, from the same loops (benchmarkIndex below). Lighthouse
// puts a mid-tier mobile phone at 125-800, and its default 4x is meant to bring a typical
// high-end desktop (1,500-2,000) into that range, so the phone here scores 400.
// https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md
export const MID_RANGE_PHONE = 400;

// Within 10% of the phone is close enough: one measurement varies about that much on its own.
const TOLERANCE = 0.1;
const MAX_CORRECTIONS = 4;
// Past this, the run would time a different phone than the one promised, so it stops instead.
const GIVE_UP = 0.2;

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

// Lighthouse's BenchmarkIndex (computeBenchmarkIndex in core/lib/page-functions.js, Apache-2.0):
// how many times a second the page can build a 10,000-character string, and copy a 100,000-item
// array, each divided by 10, averaged. Lighthouse times each loop for 500 ms with the page's own
// clock, but Playwright's page.clock can freeze that clock (this suite's Insights tests do), so
// here the page runs a set number of loops and the test runner times them.
const LOOP_SECONDS = 0.5;

function buildStrings(iterations: number) {
  for (let i = 0; i < iterations; i++) {
    let s = "";
    for (let j = 0; j < 10000; j++) s += "a";
    if (s.length === 1) throw new Error("prevents compiler optimizations");
  }
}

function copyArrays(iterations: number) {
  const scope = globalThis as { benchmarkArrays?: [number[], number[]] };
  if (!scope.benchmarkArrays) {
    const arrA: number[] = [];
    const arrB: number[] = [];
    for (let i = 0; i < 100000; i++) {
      arrA[i] = i;
      arrB[i] = i;
    }
    scope.benchmarkArrays = [arrA, arrB];
  }
  const [arrA, arrB] = scope.benchmarkArrays;
  for (let i = 0; i < iterations; i++) {
    const src = i % 2 === 0 ? arrA : arrB;
    const tgt = i % 2 === 0 ? arrB : arrA;
    for (let j = 0; j < src.length; j++) tgt[j] = src[j];
  }
}

async function loopsPerSecond(page: Page, loop: (n: number) => void) {
  const time = async (iterations: number) => {
    const started = performance.now();
    await page.evaluate(loop, iterations);
    return (performance.now() - started) / 1000;
  };
  // A short run sizes the real one, which lasts about 500 ms as Lighthouse's does.
  const probe = 20;
  const iterations = Math.max(
    probe,
    Math.round((probe * LOOP_SECONDS) / (await time(probe))),
  );
  return iterations / (await time(iterations));
}

async function benchmarkIndex(page: Page) {
  await page.evaluate(copyArrays, 0); // builds the arrays outside the timing
  const gc = await loopsPerSecond(page, buildStrings);
  const noGC = await loopsPerSecond(page, copyArrays);
  return Math.round((gc / 10 + noGC / 10) / 2);
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
 * Throws when it cannot get within 20% of the phone, rather than time a different phone.
 */
export async function emulateMidRangePhoneCpu(
  page: Page,
  cdp: CDPSession,
): Promise<PhoneCpu> {
  // Anything else on the machine only ever slows a sample down, so the best of two is the truer one.
  const benchmark = async () =>
    Math.max(await benchmarkIndex(page), await benchmarkIndex(page));
  const setRate = (rate: number) =>
    cdp.send("Emulation.setCPUThrottlingRate", { rate });

  const miss = (score: number) =>
    Math.abs(score - MID_RANGE_PHONE) / MID_RANGE_PHONE;

  await setRate(1);
  const machine = await benchmark();
  let rate = 1;
  let measured = machine;
  for (let i = 0; i < MAX_CORRECTIONS && miss(measured) > TOLERANCE; i++) {
    const next = nextThrottleRate(rate, measured);
    if (next === rate) break; // already at full speed on a machine slower than the phone
    rate = next;
    await setRate(rate);
    measured = await benchmark();
  }
  // A machine slower than the phone runs at full speed, which only makes the test harder.
  if (rate > 1 && miss(measured) > GIVE_UP) {
    throw new Error(
      `Could not emulate a mid-range phone's CPU: at ${rate.toFixed(2)}x this machine scores ${measured}, not ${MID_RANGE_PHONE}`,
    );
  }
  return { machine, rate, measured };
}
