"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

export const COUNT_MS = 400;

// Where a count from `from` to `to` has got to after `elapsedMs`, easing out (fast, then settling),
// in whole numbers. At or past the end it is exactly `to`, so a count never stops one short.
export function tweenValue(
  from: number,
  to: number,
  elapsedMs: number,
  durationMs: number,
): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return to;
  const progress = Math.max(0, elapsedMs / durationMs);
  const eased = 1 - (1 - progress) ** 3;
  return Math.round(from + (to - from) * eased);
}

type Options = {
  /** A new key means a different thing is being shown (another Day): jump, never count. */
  resetKey?: string | number;
  durationMs?: number;
};

// The number to show for `value`: when `value` changes it counts from what is on screen to the new
// one, picking up from the current figure if it changes again mid-count. It jumps when `resetKey`
// changes, and for a device that asks for reduced motion (spec 019).
export function useAnimatedNumber(
  value: number,
  { resetKey = "", durationMs = COUNT_MS }: Options = {},
) {
  const [shown, setShown] = useState(value);
  const [key, setKey] = useState(resetKey);
  const onScreen = useRef(value);

  // A different Day jumps straight to its value, in the same render, so the old one never flashes.
  if (key !== resetKey) {
    setKey(resetKey);
    setShown(value);
  }

  // Declared first, so it has run by the time the count below looks at what is on screen.
  useEffect(() => {
    onScreen.current = shown;
  }, [shown]);

  useEffect(() => {
    const from = onScreen.current;
    if (from === value) return;
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const elapsed = now - startedAt;
      setShown(tweenValue(from, value, elapsed, durationMs));
      if (elapsed < durationMs) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return shown;
}
