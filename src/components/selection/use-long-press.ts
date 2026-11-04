"use client";

import { type MouseEvent, type PointerEvent, useRef } from "react";

export const LONG_PRESS_MS = 500;
// A finger wobbles a little while it holds; moving further than this is a scroll or a swipe.
export const MOVE_TOLERANCE_PX = 10;

export type PressPhase = "holding" | "hold" | "cancelled";

// What a touch has become, from how long it has lasted and how far it has strayed. Pure, so the
// rules can be tested without a screen.
export function classifyPress(
  { heldMs, movedPx }: { heldMs: number; movedPx: number },
  delay = LONG_PRESS_MS,
  tolerance = MOVE_TOLERANCE_PX,
): PressPhase {
  if (movedPx > tolerance) return "cancelled";
  return heldMs >= delay ? "hold" : "holding";
}

type Options = {
  onLongPress: () => void;
  onPress: () => void;
  delay?: number;
  tolerance?: number;
};

// Props for one pressable item: a tap calls onPress, holding still for `delay` calls onLongPress
// instead, and the click that follows a hold is swallowed so the item is not also pressed.
export function useLongPress({
  onLongPress,
  onPress,
  delay = LONG_PRESS_MS,
  tolerance = MOVE_TOLERANCE_PX,
}: Options) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const movedPx = useRef(0);
  // Set when a hold fires; cleared by the click it causes, or by the next touch if none comes.
  const held = useRef(false);

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }

  return {
    onPointerDown(event: PointerEvent) {
      // Only the primary button or finger; a right click is not a hold.
      if (event.pointerType === "mouse" && event.button !== 0) return;
      cancel();
      held.current = false;
      movedPx.current = 0;
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        if (
          classifyPress(
            { heldMs: delay, movedPx: movedPx.current },
            delay,
            tolerance,
          ) !== "hold"
        )
          return;
        origin.current = null;
        held.current = true;
        onLongPress();
      }, delay);
    },
    onPointerMove(event: PointerEvent) {
      if (!origin.current) return;
      movedPx.current = Math.hypot(
        event.clientX - origin.current.x,
        event.clientY - origin.current.y,
      );
      if (
        classifyPress(
          { heldMs: 0, movedPx: movedPx.current },
          delay,
          tolerance,
        ) === "cancelled"
      )
        cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClick(event: MouseEvent) {
      if (held.current) {
        held.current = false;
        event.preventDefault();
        return;
      }
      onPress();
    },
    // Android opens its own menu on a long press; the hold is ours.
    onContextMenu(event: MouseEvent) {
      event.preventDefault();
    },
  };
}
