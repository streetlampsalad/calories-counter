import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";
import { clearDay, seedFood } from "./support/seed";

// Each test logs to a fixed Day long ago that only it uses, emptied first so re-runs start clean.
const total = (page: Page) => page.getByRole("region", { name: "Daily total" });
const entries = (page: Page) =>
  page.getByRole("list", { name: "Entries" }).getByRole("listitem");
const picker = (page: Page) =>
  page.getByRole("dialog", { name: "Add to your day" });

// Resolves when the server has answered a write to entries: the UI updates before that.
const savedEntry = (page: Page, method: "POST" | "DELETE") =>
  page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      response.url().includes("/rest/v1/entries"),
  );

async function openPickerFor(page: Page, foodName: string) {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(picker(page)).toBeVisible();
  await picker(page)
    .getByRole("searchbox", { name: "Search foods" })
    .fill(foodName);
  await picker(page)
    .getByRole("button", { name: new RegExp(foodName) })
    .click();
}

async function arrange(day: string, calories: number, portion = "1 slice") {
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const food = await seedFood(ada, { portion, calories });
  return { ada, food };
}

test("two taps log a Food: it appears with the total, and is still there after a reload", async ({
  page,
}) => {
  const day = "2001-04-01";
  const { food } = await arrange(day, 100);
  await page.goto(`/?day=${day}`);
  await expect(page.getByText("Nothing logged yet")).toBeVisible();

  await openPickerFor(page, food.name);
  const saved = savedEntry(page, "POST");
  await picker(page).getByRole("button", { name: "Add 1½" }).click();

  await expect(entries(page)).toHaveCount(1);
  await expect(entries(page).first()).toContainText(food.name);
  await expect(entries(page).first()).toContainText("1½ × 1 slice · 150 kcal");
  await expect(total(page)).toContainText("150");
  await expect(page.getByText(`Added 1½ × ${food.name}`)).toBeVisible();

  await saved; // the Entry is shown optimistically: make sure it landed before reloading
  await page.reload();
  await expect(entries(page)).toHaveCount(1);
  await expect(total(page)).toContainText("150");
});

test("Undo takes the Entry back off, for good", async ({ page }) => {
  const day = "2001-04-02";
  const { food } = await arrange(day, 100);
  await page.goto(`/?day=${day}`);

  await openPickerFor(page, food.name);
  await picker(page)
    .getByRole("button", { name: "Add 1", exact: true })
    .click();
  await expect(entries(page)).toHaveCount(1);

  const removed = savedEntry(page, "DELETE");
  await page.getByRole("button", { name: "Undo" }).click();

  await expect(entries(page)).toHaveCount(0);
  await expect(total(page)).toContainText("0");
  await removed;
  await page.reload();
  await expect(page.getByText("Nothing logged yet")).toBeVisible();
});

test("the stepper logs any amount in half-portion steps", async ({ page }) => {
  const day = "2001-04-03";
  const { food } = await arrange(day, 100);
  await page.goto(`/?day=${day}`);

  await openPickerFor(page, food.name);
  const more = picker(page).getByRole("button", { name: "More" });
  await more.click();
  await more.click();
  await more.click();
  await expect(picker(page).getByRole("status")).toHaveText("2½");
  await picker(page).getByRole("button", { name: "Add 2½ portions" }).click();

  await expect(entries(page).first()).toContainText("2½ × 1 slice · 250 kcal");
  await expect(total(page)).toContainText("250");
});

test("the Entry shows up before the server has answered", async ({ page }) => {
  const day = "2001-04-04";
  const { food } = await arrange(day, 100);
  await page.route("**/rest/v1/entries*", async (route) => {
    if (route.request().method() === "POST")
      await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });
  await page.goto(`/?day=${day}`);

  await openPickerFor(page, food.name);
  await picker(page)
    .getByRole("button", { name: "Add 2", exact: true })
    .click();

  // Far sooner than the 3 second server delay.
  await expect(entries(page)).toHaveCount(1, { timeout: 1500 });
  await expect(total(page)).toContainText("200", { timeout: 1500 });
});

test("a failed save takes the Entry back off and offers to retry", async ({
  page,
}) => {
  const day = "2001-04-05";
  const { food } = await arrange(day, 100);
  await page.route("**/rest/v1/entries*", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: "{}",
        })
      : route.continue(),
  );
  await page.goto(`/?day=${day}`);

  await openPickerFor(page, food.name);
  await picker(page)
    .getByRole("button", { name: "Add 1", exact: true })
    .click();

  await expect(page.getByText("Couldn't save that")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(entries(page)).toHaveCount(0);
  await expect(total(page)).toContainText("0");
});

test("the same Food logged twice in a Day is two Entries", async ({ page }) => {
  const day = "2001-04-06";
  const { food } = await arrange(day, 100);
  await page.goto(`/?day=${day}`);

  for (const label of ["Add 1", "Add 2"]) {
    await openPickerFor(page, food.name);
    await picker(page)
      .getByRole("button", { name: label, exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  await expect(entries(page)).toHaveCount(2);
  await expect(total(page)).toContainText("300");
});

test("the picker searches by typing, ignoring case and accents", async ({
  page,
}) => {
  const day = "2001-04-07";
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const tag = Math.random().toString(36).slice(2, 8);
  const cafe = await seedFood(ada, {
    name: `Café mocha ${tag}`,
    portion: "250 ml",
    calories: 150,
  });
  const toast = await seedFood(ada, {
    name: `Rye toast ${tag}`,
    portion: "1 slice",
    calories: 90,
  });
  await page.goto(`/?day=${day}`);
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await picker(page)
    .getByRole("searchbox", { name: "Search foods" })
    .fill(`CAFE ${tag}`);

  await expect(
    picker(page).getByRole("button", { name: new RegExp(cafe.name) }),
  ).toBeVisible();
  await expect(
    picker(page).getByRole("button", { name: new RegExp(toast.name) }),
  ).toHaveCount(0);
});

test("an Archived Food is not offered", async ({ page }) => {
  const day = "2001-04-08";
  const { ada, food } = await arrange(day, 100);
  await ada
    .from("foods")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", food.id);
  await page.goto(`/?day=${day}`);
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await picker(page)
    .getByRole("searchbox", { name: "Search foods" })
    .fill(food.name);

  await expect(picker(page).getByText(/No foods match/)).toBeVisible();
});

test.describe("a User with no Foods", () => {
  test.use({ storageState: authFile("cleo") });

  test("is pointed to adding one", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(picker(page).getByText("You have no foods yet")).toBeVisible();
    await picker(page)
      .getByRole("link", { name: "Add your first food" })
      .click();

    await expect(page).toHaveURL("/foods");
  });
});

test("the picker fits a phone and its Quantity buttons are easy to hit", async ({
  page,
}) => {
  const day = "2001-04-09";
  const { food } = await arrange(day, 100);
  await page.goto(`/?day=${day}`);

  await openPickerFor(page, food.name);

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
  for (const label of ["Add ½", "Add 1", "Add 1½", "Add 2", "Add 3"]) {
    const box = await picker(page)
      .getByRole("button", { name: label, exact: true })
      .boundingBox();
    expect(box?.height, label).toBeGreaterThanOrEqual(44);
    expect(box?.width, label).toBeGreaterThanOrEqual(44);
  }
});
