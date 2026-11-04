import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyPress,
  LONG_PRESS_MS,
  MOVE_TOLERANCE_PX,
  useLongPress,
} from "./use-long-press";

describe("classifyPress", () => {
  it("is holding until the delay has passed", () => {
    expect(classifyPress({ heldMs: 100, movedPx: 0 })).toBe("holding");
    expect(classifyPress({ heldMs: LONG_PRESS_MS - 1, movedPx: 0 })).toBe(
      "holding",
    );
  });

  it("is a hold once the delay has passed without moving far", () => {
    expect(classifyPress({ heldMs: LONG_PRESS_MS, movedPx: 0 })).toBe("hold");
    expect(classifyPress({ heldMs: 900, movedPx: MOVE_TOLERANCE_PX })).toBe(
      "hold",
    );
  });

  it("is cancelled by moving more than the tolerance, however long it has been", () => {
    expect(classifyPress({ heldMs: 10, movedPx: MOVE_TOLERANCE_PX + 1 })).toBe(
      "cancelled",
    );
    expect(classifyPress({ heldMs: 900, movedPx: 40 })).toBe("cancelled");
  });

  it("takes its limits as arguments", () => {
    expect(classifyPress({ heldMs: 300, movedPx: 0 }, 300, 10)).toBe("hold");
    expect(classifyPress({ heldMs: 300, movedPx: 4 }, 300, 3)).toBe(
      "cancelled",
    );
  });
});

function Row({
  onLongPress,
  onPress,
}: {
  onLongPress: () => void;
  onPress: () => void;
}) {
  const handlers = useLongPress({ onLongPress, onPress });
  return (
    <button type="button" {...handlers}>
      Row
    </button>
  );
}

describe("useLongPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const onLongPress = vi.fn();
    const onPress = vi.fn();
    render(<Row onLongPress={onLongPress} onPress={onPress} />);
    return { onLongPress, onPress, row: screen.getByRole("button") };
  };
  const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it("treats a quick tap as a press", () => {
    const { onLongPress, onPress, row } = setup();

    fireEvent.pointerDown(row, { clientX: 10, clientY: 10 });
    wait(100);
    fireEvent.pointerUp(row);
    fireEvent.click(row);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("fires once after the delay, and the click that follows is not a press", () => {
    const { onLongPress, onPress, row } = setup();

    fireEvent.pointerDown(row, { clientX: 10, clientY: 10 });
    wait(LONG_PRESS_MS);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(row);
    fireEvent.click(row);

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("does not fire before the delay", () => {
    const { onLongPress, row } = setup();

    fireEvent.pointerDown(row, { clientX: 10, clientY: 10 });
    wait(LONG_PRESS_MS - 1);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("is cancelled by moving the finger, so scrolling never selects", () => {
    const { onLongPress, row } = setup();

    fireEvent.pointerDown(row, { clientX: 10, clientY: 10 });
    wait(200);
    fireEvent.pointerMove(row, {
      clientX: 10,
      clientY: 10 + MOVE_TOLERANCE_PX + 1,
    });
    wait(1000);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("allows a little wobble", () => {
    const { onLongPress, row } = setup();

    fireEvent.pointerDown(row, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(row, { clientX: 14, clientY: 13 });
    wait(LONG_PRESS_MS);

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("is cancelled when the browser takes the touch over to scroll", () => {
    const { onLongPress, row } = setup();

    fireEvent.pointerDown(row, { clientX: 10, clientY: 10 });
    wait(200);
    fireEvent.pointerCancel(row);
    wait(1000);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("is cancelled by lifting the finger early", () => {
    const { onLongPress, row } = setup();

    fireEvent.pointerDown(row, { clientX: 10, clientY: 10 });
    wait(200);
    fireEvent.pointerUp(row);
    wait(1000);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("lets the next tap through even if the last hold never produced a click", () => {
    const { onPress, row } = setup();

    fireEvent.pointerDown(row, { clientX: 10, clientY: 10 });
    wait(LONG_PRESS_MS);
    fireEvent.pointerCancel(row); // no click followed

    fireEvent.pointerDown(row, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(row);
    fireEvent.click(row);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("keeps the phone's own long-press menu out of the way", () => {
    const { row } = setup();

    const notCancelled = fireEvent.contextMenu(row);

    expect(notCancelled).toBe(false);
  });

  it("presses on a keyboard click, which has no pointer", () => {
    const { onPress, row } = setup();

    fireEvent.click(row);

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
