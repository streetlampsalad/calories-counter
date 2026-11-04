import { expect, type Locator, type Page, test } from "@playwright/test";
import { userClient } from "./support/db";
import { clearDay, seedEntry, seedFood } from "./support/seed";

// Each test uses a fixed Day long ago that only it uses, emptied first so re-runs start clean.
const entries = (page: Page) =>
  page.getByRole("list", { name: "Entries" }).getByRole("listitem");
const row = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(name) });
const bar = (page: Page) => page.getByRole("toolbar", { name: "Selection" });
const total = (page: Page) => page.getByRole("region", { name: "Daily total" });

// Holds a pointer still on the item for longer than the long-press delay.
async function hold(page: Page, item: Locator) {
  const box = await item.boundingBox();
  if (!box) throw new Error("Nothing to hold");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
}

const savedEntry = (page: Page, method: "POST" | "DELETE") =>
  page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      response.url().includes("/rest/v1/entries"),
  );

// Three Entries of 100 kcal each, on `day`.
async function arrange(day: string) {
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const names = ["Apple", "Bread", "Cheese"].map(
    (n) => `${n} ${Math.random().toString(36).slice(2, 6)}`,
  );
  for (const name of names) {
    const food = await seedFood(ada, {
      name,
      portion: "1 piece",
      calories: 100,
    });
    await seedEntry(ada, { foodId: food.id, day, quantity: 1 });
  }
  return { ada, names };
}

test.describe("selecting Entries", () => {
  test("holding an Entry starts selection with that Entry, and does not open it", async ({
    page,
  }) => {
    const day = "2001-06-01";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);

    await hold(page, row(page, names[0]));

    await expect(bar(page)).toContainText("1 selected");
    await expect(row(page, names[0])).toHaveAttribute("aria-pressed", "true");
    await expect(row(page, names[1])).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Add", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  });

  test("taps pick and unpick Entries, and unpicking the last one ends selection", async ({
    page,
  }) => {
    const day = "2001-06-02";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);
    await hold(page, row(page, names[0]));

    await row(page, names[1]).click();
    await expect(bar(page)).toContainText("2 selected");
    await row(page, names[0]).click();
    await expect(bar(page)).toContainText("1 selected");
    await row(page, names[1]).click();

    await expect(bar(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add", exact: true }),
    ).toBeVisible();
  });

  test("a plain tap still opens the Entry when nothing is selected", async ({
    page,
  }) => {
    const day = "2001-06-03";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);

    await row(page, names[0]).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
  });

  test("Select all picks every Entry, and ✕ ends selection", async ({
    page,
  }) => {
    const day = "2001-06-04";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);
    await hold(page, row(page, names[1]));

    await bar(page).getByRole("button", { name: "Select all" }).click();
    await expect(bar(page)).toContainText("3 selected");
    await bar(page).getByRole("button", { name: "Cancel selection" }).click();

    await expect(bar(page)).toHaveCount(0);
    await expect(entries(page)).toHaveCount(3);
    await expect(row(page, names[1])).not.toHaveAttribute("aria-pressed");
  });

  test("the phone's back button ends selection without leaving the Day", async ({
    page,
  }) => {
    const day = "2001-06-05";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);
    await hold(page, row(page, names[0]));
    await expect(bar(page)).toBeVisible();

    await page.goBack();

    await expect(bar(page)).toHaveCount(0);
    await expect(page).toHaveURL(`/?day=${day}`);
    await expect(entries(page)).toHaveCount(3);
  });

  test("ending selection with ✕ leaves no extra step for back to take", async ({
    page,
  }) => {
    const day = "2001-06-06";
    const { names } = await arrange(day);
    await page.goto("/");
    await page.goto(`/?day=${day}`);
    await hold(page, row(page, names[0]));
    await bar(page).getByRole("button", { name: "Cancel selection" }).click();
    await expect(bar(page)).toHaveCount(0);

    await page.goBack();

    await expect(page).toHaveURL("/");
  });
});

test.describe("deleting selected Entries", () => {
  test("they go at once with no confirmation, and Undo puts them all back", async ({
    page,
  }) => {
    const day = "2001-06-07";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);
    await expect(total(page)).toContainText("300");
    await hold(page, row(page, names[0]));
    await row(page, names[1]).click();

    const deleted = savedEntry(page, "DELETE");
    await bar(page).getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Removed 2 entries")).toBeVisible();
    await expect(entries(page)).toHaveCount(1);
    await expect(total(page)).toContainText("100");
    await expect(bar(page)).toHaveCount(0);
    await deleted;

    const restored = savedEntry(page, "POST");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(entries(page)).toHaveCount(3);
    await expect(total(page)).toContainText("300");
    await restored;
    await page.reload();
    await expect(entries(page)).toHaveCount(3);
  });

  test("a deleted pair stays deleted after a reload", async ({ page }) => {
    const day = "2001-06-08";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);
    await hold(page, row(page, names[2]));
    await bar(page).getByRole("button", { name: "Select all" }).click();

    const deleted = savedEntry(page, "DELETE");
    await bar(page).getByRole("button", { name: "Delete" }).click();
    await deleted;

    await expect(page.getByText("Removed 3 entries")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Nothing logged yet")).toBeVisible();
  });

  test("a failed delete brings every Entry back and offers to retry", async ({
    page,
  }) => {
    const day = "2001-06-09";
    const { names } = await arrange(day);
    await page.route("**/rest/v1/entries*", (route) =>
      route.request().method() === "DELETE"
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            body: "{}",
          })
        : route.continue(),
    );
    await page.goto(`/?day=${day}`);
    await hold(page, row(page, names[0]));
    await row(page, names[1]).click();

    await bar(page).getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Couldn't save that")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(entries(page)).toHaveCount(3);
    await expect(total(page)).toContainText("300");
  });
});
