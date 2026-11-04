// The rules for swiping between Days (spec 015), apart from any screen so they can be tested
// exactly. Distances are in CSS pixels and speeds in pixels per millisecond.

/** Swipes that start this close to a screen edge belong to Android's back gesture. */
export const EDGE_PX = 24;
/** A swipe counts when it travels this fraction of the width... */
export const DISTANCE_FRACTION = 0.25;
/** ...or when it is a quick flick: at least this fast and this far. */
export const FLICK_PX_PER_MS = 0.5;
export const FLICK_MIN_PX = 40;
/** How far a finger must move before it is decided whether it is scrolling or swiping. */
export const LOCK_PX = 10;

export type SwipeAxis = "horizontal" | "vertical";
export type SwipeOutcome = "next" | "previous" | "none";

// Decided once, from the first real movement, and then kept: a gesture that starts out going up
// or down is a scroll and never changes the Day, however far sideways it wanders afterwards.
export function swipeAxis(dx: number, dy: number): SwipeAxis | undefined {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_PX) return undefined;
  return Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
}

// What a finished swipe means. Swiping left drags the next Day in from the right.
export function swipeOutcome({
  dx,
  dy,
  velocityX,
  width,
  startX,
}: {
  /** How far the finger travelled sideways and up or down. */
  dx: number;
  dy: number;
  /** Average sideways speed, negative towards the left. */
  velocityX: number;
  /** Width of the swipeable area, and where in it the finger first touched. */
  width: number;
  startX: number;
}): SwipeOutcome {
  if (startX < EDGE_PX || startX > width - EDGE_PX) return "none";
  if (Math.abs(dy) > Math.abs(dx)) return "none";

  const far = Math.abs(dx) >= width * DISTANCE_FRACTION;
  const flick =
    Math.abs(dx) >= FLICK_MIN_PX &&
    Math.abs(velocityX) >= FLICK_PX_PER_MS &&
    Math.sign(velocityX) === Math.sign(dx);
  if (!far && !flick) return "none";

  return dx < 0 ? "next" : "previous";
}
