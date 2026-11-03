import { expect, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";
import { clearDay, seedEntry, seedFood } from "./support/seed";

// Each test owns a fixed Day long ago, so its totals are deterministic and nobody else touches it.
const total = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Daily total" });

test("shows the Day's Entries, newest first, and their total", async ({
  page,
}) => {
  const day = "2001-03-04"; // a Sunday
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const toast = await seedFood(ada, { portion: "1 slice", calories: 110 });
  const rice = await seedFood(ada, { portion: "100 g", calories: 130 });
  await seedEntry(ada, { foodId: toast.id, day, quantity: 1.5 });
  await seedEntry(ada, { foodId: rice.id, day, quantity: 2 });

  await page.goto(`/?day=${day}`);

  await expect(
    page.getByRole("heading", { name: "Sun 4 Mar 2001" }),
  ).toBeVisible();
  await expect(total(page)).toContainText("425");
  const rows = page
    .getByRole("list", { name: "Entries" })
    .getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(rice.name);
  await expect(rows.nth(0)).toContainText("2 × 100 g · 260 kcal");
  await expect(rows.nth(1)).toContainText(toast.name);
  await expect(rows.nth(1)).toContainText("1½ × 1 slice · 165 kcal");
});

test("a Day with nothing logged says so and totals zero", async ({ page }) => {
  const day = "2001-03-05";
  await clearDay(await userClient("ada"), day);

  await page.goto(`/?day=${day}`);

  await expect(page.getByText("Nothing logged yet")).toBeVisible();
  await expect(total(page)).toContainText("0");
});

test("editing or archiving a Food changes the totals of every Day it appears on (ADR 0001)", async ({
  page,
}) => {
  const day = "2001-03-06";
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const food = await seedFood(ada, { portion: "1 piece", calories: 100 });
  await seedEntry(ada, { foodId: food.id, day, quantity: 2 });

  await page.goto(`/?day=${day}`);
  await expect(total(page)).toContainText("200");

  await ada.from("foods").update({ calories: 150 }).eq("id", food.id);
  await page.reload();
  await expect(total(page)).toContainText("300");

  await ada
    .from("foods")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", food.id);
  await page.reload();
  await expect(total(page)).toContainText("300");
  await expect(page.getByRole("list", { name: "Entries" })).toContainText(
    food.name,
  );
});

test("half portions add up without drifting", async ({ page }) => {
  const day = "2001-03-07";
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const food = await seedFood(ada, { portion: "1 slice", calories: 55 });
  await seedEntry(ada, { foodId: food.id, day, quantity: 0.5 });
  await seedEntry(ada, { foodId: food.id, day, quantity: 0.5 });

  await page.goto(`/?day=${day}`);

  await expect(total(page)).toContainText("55");
  await expect(total(page)).not.toContainText("56");
});

test("an unusable or future Day falls back to Today", async ({ page }) => {
  for (const param of ["2999-01-01", "nonsense", "2026-02-30"]) {
    await page.goto(`/?day=${param}`);
    await expect(
      page.getByRole("heading", { name: "Today" }),
      param,
    ).toBeVisible();
  }
});

test.describe("another User", () => {
  test.use({ storageState: authFile("bea") });

  test("never sees someone else's Entries", async ({ page }) => {
    const day = "2001-03-08";
    const ada = await userClient("ada");
    await clearDay(ada, day);
    const food = await seedFood(ada, { calories: 500 });
    await seedEntry(ada, { foodId: food.id, day, quantity: 1 });

    await page.goto(`/?day=${day}`);

    await expect(page.getByText("Nothing logged yet")).toBeVisible();
    await expect(total(page)).toContainText("0");
  });
});

test("Today fits a phone without sideways scrolling", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
});
