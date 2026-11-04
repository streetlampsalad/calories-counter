import { expect, type Page, test } from "@playwright/test";
import { userClient } from "./support/db";
import { centreOf, touchDrag } from "./support/gestures";
import { clearDay, seedEntry, seedFood } from "./support/seed";

// Bottom sheets close by dragging them down (spec 015 AC-7). Each test uses a fixed Day long ago
// that only it uses.
const picker = (page: Page) =>
  page.getByRole("dialog", { name: "Add to your day" });

async function arrangeEntry(day: string) {
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const food = await seedFood(ada, { portion: "1 slice", calories: 100 });
  await seedEntry(ada, { foodId: food.id, day, quantity: 1 });
  return food;
}

test.describe("dragging a bottom sheet down", () => {
  test("closes the picker, as a tap on the backdrop would", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(picker(page)).toBeVisible();
    const grip = await centreOf(
      picker(page).getByRole("heading", { name: "Add to your day" }),
    );

    await touchDrag(page, grip, { x: grip.x, y: grip.y + 450 });

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today");
  });

  test("snaps back when it is only pulled a little", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(picker(page)).toBeVisible();
    const grip = await centreOf(
      picker(page).getByRole("heading", { name: "Add to your day" }),
    );

    await touchDrag(page, grip, { x: grip.x, y: grip.y + 40 }, { stepMs: 40 });
    await page.waitForTimeout(600);

    await expect(picker(page)).toBeVisible();
    await expect(picker(page)).toBeInViewport();
  });

  test("closes the sheet for an Entry without changing the Entry", async ({
    page,
  }) => {
    const day = "2001-09-01";
    const food = await arrangeEntry(day);
    await page.goto(`/?day=${day}`);
    await page.getByRole("button", { name: new RegExp(food.name) }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const grip = await centreOf(sheet.getByRole("heading").first());

    await touchDrag(page, grip, { x: grip.x, y: grip.y + 450 });

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: new RegExp(food.name) }),
    ).toContainText("1 × 1 slice · 100 kcal");
  });

  test("leaves a tap outside, and the Escape key, closing sheets as before", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(picker(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(picker(page)).toBeVisible();
    await page.mouse.click(200, 20);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("works for a sheet with a form in it, and the form still takes taps and typing", async ({
    page,
  }) => {
    await page.goto("/foods");
    await page.getByRole("button", { name: "Add food" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: /Enter manually/ }).click();
    const name = sheet.getByLabel("Name");
    await name.fill("Typing still works");
    await expect(name).toHaveValue("Typing still works");
    const grip = await centreOf(sheet.getByRole("heading").first());

    await touchDrag(page, grip, { x: grip.x, y: grip.y + 500 });

    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
