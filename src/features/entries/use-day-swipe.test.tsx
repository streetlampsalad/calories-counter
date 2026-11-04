import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDaySwipe } from "./use-day-swipe";

const WIDTH = 400;

function Harness({
  enabled = true,
  canGoNext = true,
  onSwipe,
  onClick,
}: {
  enabled?: boolean;
  canGoNext?: boolean;
  onSwipe: (direction: "next" | "previous", animate: boolean) => void;
  onClick?: () => void;
}) {
  const { gestureProps, offset, dragging } = useDaySwipe({
    enabled,
    canGoNext,
    onSwipe,
  });
  return (
    <div data-testid="area" {...gestureProps}>
      <button type="button" onClick={onClick}>
        Row
      </button>
      <output data-testid="state">{`${offset}|${dragging}`}</output>
    </div>
  );
}

const area = () => screen.getByTestId("area");
const state = () => screen.getByTestId("state").textContent;

// A finger: down at (x, 100), then across to `to`, taking `ms` in total.
function drag(
  from: number,
  to: number,
  { ms = 200, dy = 0, release = true } = {},
) {
  fireEvent.pointerDown(area(), {
    pointerId: 1,
    clientX: from,
    clientY: 100,
  });
  act(() => vi.advanceTimersByTime(ms / 2));
  fireEvent.pointerMove(area(), {
    pointerId: 1,
    clientX: from + (to - from) / 2,
    clientY: 100 + dy / 2,
  });
  act(() => vi.advanceTimersByTime(ms / 2));
  fireEvent.pointerMove(area(), {
    pointerId: 1,
    clientX: to,
    clientY: 100 + dy,
  });
  if (release) fireEvent.pointerUp(area(), { pointerId: 1 });
}

function reduceMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

describe("useDaySwipe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reduceMotion(false);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: WIDTH,
      bottom: 800,
      width: WIDTH,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("goes to the next Day after a long swipe left", () => {
    const onSwipe = vi.fn();
    render(<Harness onSwipe={onSwipe} />);

    drag(300, 150);

    expect(onSwipe).toHaveBeenCalledTimes(1);
    expect(onSwipe).toHaveBeenCalledWith("next", true);
  });

  it("goes to the previous Day after a long swipe right", () => {
    const onSwipe = vi.fn();
    render(<Harness onSwipe={onSwipe} />);

    drag(100, 250);

    expect(onSwipe).toHaveBeenCalledWith("previous", true);
  });

  it("follows the finger while it moves, and lets go afterwards", () => {
    render(<Harness onSwipe={vi.fn()} />);

    drag(300, 200, { release: false });
    expect(state()).toBe("-100|true");

    fireEvent.pointerUp(area(), { pointerId: 1 });
    expect(state()).toBe("0|false");
  });

  it("snaps back from a short, slow swipe without changing Day", () => {
    const onSwipe = vi.fn();
    render(<Harness onSwipe={onSwipe} />);

    drag(300, 260, { ms: 600 });

    expect(onSwipe).not.toHaveBeenCalled();
    expect(state()).toBe("0|false");
  });

  it("counts a quick flick even though it is short", () => {
    const onSwipe = vi.fn();
    render(<Harness onSwipe={onSwipe} />);

    drag(300, 230, { ms: 60 });

    expect(onSwipe).toHaveBeenCalledWith("next", true);
  });

  it("leaves a mostly vertical gesture to the page, however far it goes", () => {
    const onSwipe = vi.fn();
    render(<Harness onSwipe={onSwipe} />);

    drag(300, 280, { dy: -260, release: false });
    expect(state()).toBe("0|false");
    fireEvent.pointerMove(area(), {
      pointerId: 1,
      clientX: 100,
      clientY: -160,
    });
    expect(state()).toBe("0|false");
    fireEvent.pointerUp(area(), { pointerId: 1 });

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("ignores a swipe that starts at the left screen edge, where Android's back lives", () => {
    const onSwipe = vi.fn();
    render(<Harness onSwipe={onSwipe} />);

    drag(10, 250);

    expect(onSwipe).not.toHaveBeenCalled();
    expect(state()).toBe("0|false");
  });

  it("ignores a swipe that starts at the right screen edge", () => {
    const onSwipe = vi.fn();
    render(<Harness onSwipe={onSwipe} />);

    drag(WIDTH - 10, 100);

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("snaps back at the last Day that can be planned, pulling only a little", () => {
    const onSwipe = vi.fn();
    render(<Harness canGoNext={false} onSwipe={onSwipe} />);

    drag(300, 100, { release: false });
    expect(state()).toBe("-50|true");
    fireEvent.pointerUp(area(), { pointerId: 1 });

    expect(onSwipe).not.toHaveBeenCalled();
    expect(state()).toBe("0|false");
  });

  it("still goes back from the last plannable Day", () => {
    const onSwipe = vi.fn();
    render(<Harness canGoNext={false} onSwipe={onSwipe} />);

    drag(100, 300);

    expect(onSwipe).toHaveBeenCalledWith("previous", true);
  });

  it("does nothing while disabled, as when a sheet is open or items are being picked", () => {
    const onSwipe = vi.fn();
    render(<Harness enabled={false} onSwipe={onSwipe} />);

    drag(300, 100, { release: false });
    expect(state()).toBe("0|false");
    fireEvent.pointerUp(area(), { pointerId: 1 });

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("lets go of a swipe in progress when it gets disabled", () => {
    const onSwipe = vi.fn();
    const { rerender } = render(<Harness onSwipe={onSwipe} />);
    drag(300, 200, { release: false });
    expect(state()).toBe("-100|true");

    rerender(<Harness enabled={false} onSwipe={onSwipe} />);

    expect(state()).toBe("0|false");
    fireEvent.pointerUp(area(), { pointerId: 1 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("changes the Day under reduced motion, but without the sliding", () => {
    reduceMotion(true);
    const onSwipe = vi.fn();
    render(<Harness onSwipe={onSwipe} />);

    drag(300, 200, { release: false });
    expect(state()).toBe("0|true");
    fireEvent.pointerMove(area(), { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(area(), { pointerId: 1 });

    expect(onSwipe).toHaveBeenCalledWith("next", false);
  });

  it("is cancelled when the browser takes the touch over to scroll", () => {
    const onSwipe = vi.fn();
    render(<Harness onSwipe={onSwipe} />);

    drag(300, 150, { release: false });
    fireEvent.pointerCancel(area(), { pointerId: 1 });

    expect(state()).toBe("0|false");
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("does not also tap whatever was under the finger when a swipe ends", () => {
    const onClick = vi.fn();
    render(<Harness onSwipe={vi.fn()} onClick={onClick} />);

    drag(300, 100);
    fireEvent.click(screen.getByRole("button", { name: "Row" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("still lets a plain tap through", () => {
    const onClick = vi.fn();
    render(<Harness onSwipe={vi.fn()} onClick={onClick} />);

    fireEvent.pointerDown(area(), { pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.pointerUp(area(), { pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Row" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ignores a second finger", () => {
    const onSwipe = vi.fn();
    render(<Harness onSwipe={onSwipe} />);

    fireEvent.pointerDown(area(), { pointerId: 1, clientX: 300, clientY: 100 });
    fireEvent.pointerDown(area(), { pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(area(), { pointerId: 2, clientX: 350, clientY: 100 });
    fireEvent.pointerUp(area(), { pointerId: 2 });

    expect(onSwipe).not.toHaveBeenCalled();
  });
});
