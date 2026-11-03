import { expect, type Page, test } from "@playwright/test";
import { userClient } from "./support/db";
import { clearDay, seedEntry, seedFood } from "./support/seed";

// Each test owns a fixed Day long ago, emptied first so re-runs start clean.
const total = (page: Page) => page.getByRole("region", { name: "Daily total" });
const rows = (page: Page) =>
  page.getByRole("list", { name: "Entries" }).getByRole("listitem");
const editor = (page: Page) => page.getByRole("dialog", { name: "Edit entry" });

// The UI updates before the server answers, so tests that reload wait for the write first.
const write = (page: Page, method: "PATCH" | "DELETE" | "POST") =>
  page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      response.url().includes("/rest/v1/entries"),
  );

async function arrange(
  day: string,
  entries: Array<{ calories: number; quantity: number }>,
) {
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const foods = [];
  for (const { calories, quantity } of entries) {
    const food = await seedFood(ada, { portion: "1 slice", calories });
    await seedEntry(ada, { foodId: food.id, day, quantity });
    foods.push(food);
  }
  return foods;
}

test("tapping an Entry changes its Quantity in one tap, and the total follows", async ({
  page,
}) => {
  const day = "2001-05-01";
  const [food] = await arrange(day, [{ calories: 100, quantity: 1 }]);
  await page.goto(`/?day=${day}`);
  await expect(total(page)).toContainText("100");

  await rows(page).filter({ hasText: food.name }).getByRole("button").click();
  await expect(editor(page)).toBeVisible();
  const saved = write(page, "PATCH");
  await editor(page).getByRole("button", { name: "Set to 3" }).click();

  await expect(rows(page).first()).toContainText("3 × 1 slice · 300 kcal");
  await expect(total(page)).toContainText("300");
  await saved;
  await page.reload();
  await expect(total(page)).toContainText("300");
});

test("the stepper starts from the current Quantity", async ({ page }) => {
  const day = "2001-05-02";
  const [food] = await arrange(day, [{ calories: 100, quantity: 1.5 }]);
  await page.goto(`/?day=${day}`);

  await rows(page).filter({ hasText: food.name }).getByRole("button").click();
  await expect(editor(page).getByRole("status")).toHaveText("1½");
  await editor(page).getByRole("button", { name: "More" }).click();
  await editor(page).getByRole("button", { name: "Set to 2 portions" }).click();

  await expect(rows(page).first()).toContainText("2 × 1 slice · 200 kcal");
});

test("removing an Entry offers Undo, which puts it back in its original place", async ({
  page,
}) => {
  const day = "2001-05-03";
  const [first, second] = await arrange(day, [
    { calories: 100, quantity: 1 },
    { calories: 200, quantity: 1 },
  ]);
  await page.goto(`/?day=${day}`);
  // Newest first: the second Entry is on top.
  await expect(rows(page).nth(0)).toContainText(second.name);
  await expect(rows(page).nth(1)).toContainText(first.name);
  await expect(total(page)).toContainText("300");

  await rows(page).filter({ hasText: second.name }).getByRole("button").click();
  const removed = write(page, "DELETE");
  await editor(page).getByRole("button", { name: "Remove entry" }).click();

  await expect(rows(page)).toHaveCount(1);
  await expect(total(page)).toContainText("100");
  await expect(page.getByText(`Removed 1 × ${second.name}`)).toBeVisible();
  await removed;

  const restored = write(page, "POST");
  await page.getByRole("button", { name: "Undo" }).click();

  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(0)).toContainText(second.name);
  await expect(rows(page).nth(1)).toContainText(first.name);
  await expect(total(page)).toContainText("300");
  await restored;
  await page.reload();
  await expect(rows(page).nth(0)).toContainText(second.name);
  await expect(total(page)).toContainText("300");
});

test("a removal that is not undone stays removed after a reload", async ({
  page,
}) => {
  const day = "2001-05-04";
  const [food] = await arrange(day, [{ calories: 100, quantity: 1 }]);
  await page.goto(`/?day=${day}`);

  await rows(page).filter({ hasText: food.name }).getByRole("button").click();
  const removed = write(page, "DELETE");
  await editor(page).getByRole("button", { name: "Remove entry" }).click();
  await removed;

  await page.reload();
  await expect(page.getByText("Nothing logged yet")).toBeVisible();
});

test("a failed change puts the old Quantity back and offers to retry", async ({
  page,
}) => {
  const day = "2001-05-05";
  const [food] = await arrange(day, [{ calories: 100, quantity: 1 }]);
  await page.route("**/rest/v1/entries*", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: "{}",
        })
      : route.continue(),
  );
  await page.goto(`/?day=${day}`);

  await rows(page).filter({ hasText: food.name }).getByRole("button").click();
  await editor(page).getByRole("button", { name: "Set to 3" }).click();

  await expect(page.getByText("Couldn't save that")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(rows(page).first()).toContainText("1 × 1 slice · 100 kcal");
  await expect(total(page)).toContainText("100");
});

test("Entries are easy to hit on a phone", async ({ page }) => {
  const day = "2001-05-06";
  const [food] = await arrange(day, [{ calories: 100, quantity: 1 }]);
  await page.goto(`/?day=${day}`);

  const box = await rows(page)
    .filter({ hasText: food.name })
    .getByRole("button")
    .boundingBox();

  expect(box?.height).toBeGreaterThanOrEqual(56);
});
