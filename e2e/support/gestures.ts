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
