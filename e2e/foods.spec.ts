import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";

// Tests share ada's Food List, so every Food gets a unique name and nothing counts rows.
const unique = (base: string) =>
  `${base} ${Math.random().toString(36).slice(2, 8)}`;

async function addFood(
  page: Page,
  name: string,
  portion: string,
  calories: string,
) {
  await page.getByRole("button", { name: "Add food" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Portion").fill(portion);
  await page.getByLabel("Calories").fill(calories);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

const list = (page: Page) => page.getByRole("list", { name: "Your foods" });

test.describe("an empty Food List", () => {
  test.use({ storageState: authFile("cleo") });

  test("explains what Foods are and offers to add one", async ({ page }) => {
    await page.goto("/foods");

    await expect(
      page.getByRole("heading", { name: "No foods yet" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add food" })).toBeVisible();
  });
});

test("a new Food appears in the list straight away, and is still there after a reload", async ({
  page,
}) => {
  const name = unique("Sourdough toast");
  await page.goto("/foods");

  await addFood(page, name, "1 slice", "110");

  const row = list(page).getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("1 slice · 110 kcal");

  await page.reload();
  await expect(
    list(page).getByRole("listitem").filter({ hasText: name }),
  ).toBeVisible();
});

test("Foods are listed alphabetically", async ({ page }) => {
  const suffix = unique("sort");
  const early = `Aaa ${suffix}`;
  const late = `Zzz ${suffix}`;
  await page.goto("/foods");

  await addFood(page, late, "1 piece", "10");
  await expect(list(page).getByText(late)).toBeVisible();
  await addFood(page, early, "1 piece", "10");
  await expect(list(page).getByText(early)).toBeVisible();

  const names = await list(page).getByRole("listitem").allInnerTexts();
  const position = (name: string) =>
    names.findIndex((text) => text.startsWith(name));
  expect(position(early)).toBeGreaterThanOrEqual(0);
  expect(position(early)).toBeLessThan(position(late));
});

test("an incomplete form says what is missing and saves nothing", async ({
  page,
}) => {
  await page.goto("/foods");
  await page.getByRole("button", { name: "Add food" }).click();

  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText("Enter a name")).toBeVisible();
  await expect(
    page.getByText("Calories must be a whole number from 0 to 9,999"),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("the same name and Portion cannot be added twice, whatever the case", async ({
  page,
}) => {
  const name = unique("Duplicate bread");
  await page.goto("/foods");
  await addFood(page, name, "1 slice", "90");
  await expect(list(page).getByText(name)).toBeVisible();

  await addFood(page, name.toUpperCase(), "1 SLICE", "95");

  await expect(
    page.getByText(`You already have ${name.toUpperCase()}`, { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("the Foods screen fits a phone without sideways scrolling", async ({
  page,
}) => {
  await page.goto("/foods");
  await expect(page.getByRole("heading", { name: "Foods" })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
});
