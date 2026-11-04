"use client";

import { type PointerEvent, useEffect, useRef, useState } from "react";
import { type SwipeAxis, swipeAxis, swipeOutcome } from "./swipe";

type Options = {
  /** Off while a sheet is open or items are being picked. */
  enabled: boolean;
  /** False on the last Day that can be planned: a swipe left snaps back there. */
  canGoNext: boolean;
  /** `animate` is false when the device asks for reduced motion. */
  onSwipe: (direction: "next" | "previous", animate: boolean) => void;
};

type Gesture = {
  id: number;
  x0: number;
  y0: number;
  t0: number;
  /** Where the area starts and how wide it is, to tell the screen edges. */
  left: number;
  width: number;
  dx: number;
  dy: number;
  axis?: SwipeAxis;
};

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Pulling past the last plannable Day moves the content only a quarter as far.
const RUBBER_BAND = 0.25;

// Swiping sideways across the Day view moves between Days. Spread `gestureProps` on the area that
// listens, and slide its content by `offset` while `dragging`.
export function useDaySwipe({ enabled, canGoNext, onSwipe }: Options) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  // A swipe that ends over a button must not also press it.
  const swiped = useRef(false);

  function reset() {
    gesture.current = null;
    setDragging(false);
    setOffset(0);
  }

  useEffect(() => {
    if (!enabled) {
      gesture.current = null;
      setDragging(false);
      setOffset(0);
    }
  }, [enabled]);

  return {
    offset,
    dragging,
    gestureProps: {
      // Vertical panning stays with the browser; sideways is ours.
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (!enabled || gesture.current) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        swiped.current = false;
        gesture.current = {
          id: event.pointerId,
          x0: event.clientX,
          y0: event.clientY,
          t0: performance.now(),
          left: rect.left,
          width: rect.width,
          dx: 0,
          dy: 0,
        };
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const g = gesture.current;
        if (!g || event.pointerId !== g.id) return;
        g.dx = event.clientX - g.x0;
        g.dy = event.clientY - g.y0;
        if (!g.axis) {
          g.axis = swipeAxis(g.dx, g.dy);
          if (g.axis === "horizontal") {
            // Keep hearing the finger even if it slides off the area. Best effort: a pointer
            // that has already gone cannot be captured.
            try {
              event.currentTarget.setPointerCapture?.(event.pointerId);
            } catch {}
            setDragging(true);
          }
        }
        if (g.axis !== "horizontal" || prefersReducedMotion()) return;
        setOffset(g.dx < 0 && !canGoNext ? g.dx * RUBBER_BAND : g.dx);
      },
      onPointerUp(event: PointerEvent<HTMLElement>) {
        const g = gesture.current;
        if (!g || event.pointerId !== g.id) return;
        if (g.axis === "horizontal") {
          const elapsed = Math.max(1, performance.now() - g.t0);
          const outcome = swipeOutcome({
            dx: g.dx,
            dy: g.dy,
            velocityX: g.dx / elapsed,
            width: g.width,
            startX: g.x0 - g.left,
          });
          if (outcome === "previous" || (outcome === "next" && canGoNext)) {
            swiped.current = true;
            onSwipe(outcome, !prefersReducedMotion());
          }
        }
        reset();
      },
      onPointerCancel(event: PointerEvent<HTMLElement>) {
        if (gesture.current?.id === event.pointerId) reset();
      },
      onClickCapture(event: React.MouseEvent) {
        if (!swiped.current) return;
        swiped.current = false;
        event.stopPropagation();
        event.preventDefault();
      },
    },
  };
}
