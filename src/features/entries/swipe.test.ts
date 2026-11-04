import { describe, expect, it } from "vitest";
import {
  DISTANCE_FRACTION,
  EDGE_PX,
  FLICK_MIN_PX,
  FLICK_PX_PER_MS,
  LOCK_PX,
  swipeAxis,
  swipeOutcome,
} from "./swipe";

const WIDTH = 400;
const swipe = (
  over: Partial<Parameters<typeof swipeOutcome>[0]> = {},
): ReturnType<typeof swipeOutcome> =>
  swipeOutcome({
    dx: 0,
    dy: 0,
    velocityX: 0,
    width: WIDTH,
    startX: 200,
    ...over,
  });

describe("swipeAxis", () => {
  it("is undecided until the finger has moved a little", () => {
    expect(swipeAxis(0, 0)).toBeUndefined();
    expect(swipeAxis(LOCK_PX - 1, 0)).toBeUndefined();
    expect(swipeAxis(3, -4)).toBeUndefined();
  });

  it("is horizontal when the first movement is mostly sideways", () => {
    expect(swipeAxis(LOCK_PX, 2)).toBe("horizontal");
    expect(swipeAxis(-20, 5)).toBe("horizontal");
  });

  it("is vertical when the first movement is mostly up or down", () => {
    expect(swipeAxis(2, LOCK_PX)).toBe("vertical");
    expect(swipeAxis(5, -20)).toBe("vertical");
  });

  it("calls an exactly diagonal move vertical, so scrolling wins a tie", () => {
    expect(swipeAxis(15, 15)).toBe("vertical");
  });
});

describe("swipeOutcome", () => {
  const far = WIDTH * DISTANCE_FRACTION;

  it("goes to the next Day for a long swipe left", () => {
    expect(swipe({ dx: -far })).toBe("next");
    expect(swipe({ dx: -300 })).toBe("next");
  });

  it("goes to the previous Day for a long swipe right", () => {
    expect(swipe({ dx: far })).toBe("previous");
    expect(swipe({ dx: 300 })).toBe("previous");
  });

  it("does nothing for a short, slow swipe", () => {
    expect(swipe({ dx: -(far - 1), velocityX: -0.1 })).toBe("none");
    expect(swipe({ dx: 50, velocityX: 0.1 })).toBe("none");
  });

  it("counts a quick flick even when it is short", () => {
    expect(swipe({ dx: -60, velocityX: -(FLICK_PX_PER_MS + 0.1) })).toBe(
      "next",
    );
    expect(swipe({ dx: 60, velocityX: FLICK_PX_PER_MS + 0.1 })).toBe(
      "previous",
    );
  });

  it("does not count a flick that barely moved", () => {
    expect(swipe({ dx: -(FLICK_MIN_PX - 1), velocityX: -3 })).toBe("none");
  });

  it("does not count a flick against the direction of travel", () => {
    // Moved left overall, but the last of it was moving right: not a flick left.
    expect(swipe({ dx: -60, velocityX: 2 })).toBe("none");
  });

  it("ignores a swipe that starts at the left edge, where Android's back gesture lives", () => {
    expect(swipe({ dx: 300, startX: EDGE_PX - 1 })).toBe("none");
    expect(swipe({ dx: 300, startX: 0 })).toBe("none");
  });

  it("ignores a swipe that starts at the right edge", () => {
    expect(swipe({ dx: -300, startX: WIDTH - EDGE_PX + 1 })).toBe("none");
    expect(swipe({ dx: -300, startX: WIDTH })).toBe("none");
  });

  it("allows a swipe that starts just inside the edge", () => {
    expect(swipe({ dx: 300, startX: EDGE_PX })).toBe("previous");
    expect(swipe({ dx: -300, startX: WIDTH - EDGE_PX })).toBe("next");
  });

  it("does nothing for a gesture that is mostly vertical, however far sideways it strayed", () => {
    expect(swipe({ dx: -150, dy: 220 })).toBe("none");
    expect(swipe({ dx: 150, dy: -151 })).toBe("none");
  });

  it("does nothing when the finger did not move", () => {
    expect(swipe()).toBe("none");
  });
});
