import type { Locator, Page } from "@playwright/test";

// Holds a pointer still on the item for longer than the long-press delay.
export async function hold(page: Page, item: Locator) {
  const box = await item.boundingBox();
  if (!box) throw new Error("Nothing to hold");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
}

// A finger dragged from one point to another, as real touch events from the browser itself, so
// the page scrolls and gestures behave as they do on a phone (a mouse drag does not scroll).
export async function touchDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  { steps = 12, stepMs = 12 } = {},
) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (
    type: "touchStart" | "touchMove" | "touchEnd",
    point?: { x: number; y: number },
  ) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: point ? [point] : [],
    });
  try {
    await touch("touchStart", from);
    for (let i = 1; i <= steps; i++) {
      await touch("touchMove", {
        x: from.x + ((to.x - from.x) * i) / steps,
        y: from.y + ((to.y - from.y) * i) / steps,
      });
      await page.waitForTimeout(stepMs);
    }
    await touch("touchEnd");
  } finally {
    await cdp.detach();
  }
}

// The middle of an element, to start a drag from.
export async function centreOf(item: Locator) {
  const box = await item.boundingBox();
  if (!box) throw new Error("Nothing on screen to drag");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
