import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";
import {
  resetSettings,
  resetUser,
  seedEntries,
  seedFood,
} from "./support/seed";

// Insights depend on a whole window of a User's history, so these use gus alone, one at a time,
// on a frozen Tuesday (3 Nov 2026, 1 pm in Sydney) so every number is known in advance.
test.describe.configure({ mode: "serial" });
test.use({ storageState: authFile("gus"), timezoneId: "Australia/Sydney" });

const NOW = new Date("2026-11-03T02:00:00Z");
const chip = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Period" }).getByRole("link", { name });

async function startFresh() {
  const gus = await userClient("gus");
  await resetUser(gus);
  await resetSettings(gus);
  return gus;
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test("the Summary leads to Insights for the same Period", async ({ page }) => {
  await startFresh();
  await page.goto("/summary?period=last-week");

  await page.getByRole("link", { name: "See insights" }).click();

  await expect(page).toHaveURL("/summary/insights?range=last-week");
  await expect(
    page.getByRole("heading", { name: "Insights", level: 1 }),
  ).toBeVisible();
  await expect(chip(page, "Last week")).toHaveAttribute("aria-current", "true");
  await expect(page.getByText("26 Oct – 1 Nov")).toBeVisible();
});

test("offers the five Periods and 3, 6 and 12 months", async ({ page }) => {
  await startFresh();

  await page.goto("/summary/insights");

  const labels = await page
    .getByRole("navigation", { name: "Period" })
    .getByRole("link")
    .allInnerTexts();
  expect(labels).toEqual([
    "This week",
    "Last week",
    "This month",
    "Last month",
    "Last 30 days",
    "3 months",
    "6 months",
    "12 months",
  ]);
});

test("opens on 3 months when no range is given, or an unknown one", async ({
  page,
}) => {
  await startFresh();

  await page.goto("/summary/insights");
  await expect(chip(page, "3 months")).toHaveAttribute("aria-current", "true");
  await expect(page.getByText("6 Aug – 3 Nov")).toBeVisible();

  await page.goto("/summary/insights?range=nonsense");
  await expect(chip(page, "3 months")).toHaveAttribute("aria-current", "true");
});

test("the long ranges cover the Days up to today", async ({ page }) => {
  await startFresh();
  await page.goto("/summary/insights");

  await chip(page, "6 months").click();
  await expect(page).toHaveURL("/summary/insights?range=6-months");
  await expect(page.getByText("8 May – 3 Nov")).toBeVisible();

  await chip(page, "12 months").click();
  await expect(page.getByText("4 Nov 2025 – 3 Nov 2026")).toBeVisible();
});

test("the Summary tab stays highlighted, and Summary leads back", async ({
  page,
}) => {
  await startFresh();
  await page.goto("/summary/insights?range=last-month");

  await expect(
    page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Summary" }),
  ).toHaveAttribute("aria-current", "page");

  await page
    .getByRole("main")
    .getByRole("link", { name: "Summary", exact: true })
    .click();
  await expect(page).toHaveURL("/summary?period=last-month");
});

test("a long range leads back to This week, since the Summary has no such Period", async ({
  page,
}) => {
  await startFresh();
  await page.goto("/summary/insights?range=12-months");

  await page
    .getByRole("main")
    .getByRole("link", { name: "Summary", exact: true })
    .click();

  await expect(page).toHaveURL("/summary?period=this-week");
});

test("Insights fits a phone, and its chips are easy to tap", async ({
  page,
}) => {
  await startFresh();
  await page.goto("/summary/insights");

  const box = await chip(page, "3 months").boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
});

// 30 Days, 5 Oct to 3 Nov: the first 14 at 2,000 kcal, the rest at 1,700, so the 7-day average
// falls from 2,000 (from 11 Oct, the first full window) to 1,700.
async function arrangeFalling(goal?: number) {
  const gus = await startFresh();
  const food = await seedFood(gus, {
    name: "Hundred",
    portion: "1 serve",
    calories: 100,
  });
  const entries = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 9, 5 + i)).toISOString().slice(0, 10);
    return { foodId: food.id, day: date, quantity: i < 14 ? 20 : 17 };
  });
  await seedEntries(gus, entries);
  if (goal !== undefined) {
    await gus
      .from("user_settings")
      .upsert({ daily_goal_calories: goal }, { onConflict: "user_id" });
  }
  return gus;
}

const trendCard = (page: Page) => page.getByRole("region", { name: "Trend" });

test("the Trend card says where the 7-day average has gone, in words", async ({
  page,
}) => {
  await arrangeFalling();

  await page.goto("/summary/insights?range=last-30-days");

  await expect(trendCard(page)).toContainText(
    "Your 7-day average is down 300 kcal since 11 Oct",
  );
  await expect(page.getByTestId("trend-last")).toHaveText("1,700");
  await expect(page.getByTestId("trend-line").locator("path")).toHaveCount(1);
});

test("with a Goal the Trend card draws the Goal line", async ({ page }) => {
  await arrangeFalling(1800);

  await page.goto("/summary/insights?range=last-30-days");

  await expect(page.getByTestId("trend-goal")).toContainText("Goal 1,800");
});

test("without a Goal there is no Goal line on the Trend card", async ({
  page,
}) => {
  await arrangeFalling();

  await page.goto("/summary/insights?range=last-30-days");

  await expect(trendCard(page)).toBeVisible();
  await expect(page.getByTestId("trend-goal")).toHaveCount(0);
});

test("pointing at the line says which Day and its average", async ({
  page,
}) => {
  await arrangeFalling();
  await page.goto("/summary/insights?range=last-30-days");
  await expect(page.getByTestId("trend-detail")).toContainText(
    "Touch or point at the line",
  );

  const box = await page.getByTestId("trend-line").boundingBox();
  if (!box) throw new Error("no chart");
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2);

  await expect(page.getByTestId("trend-detail")).toHaveText(
    "Today: 7-day average 1,700 kcal",
  );
});

test("too little data says what is needed instead of drawing a line", async ({
  page,
}) => {
  const gus = await startFresh();
  const food = await seedFood(gus, { portion: "1 serve", calories: 100 });
  await seedEntries(
    gus,
    ["2026-10-30", "2026-10-31", "2026-11-01"].map((day) => ({
      foodId: food.id,
      day,
      quantity: 10,
    })),
  );

  await page.goto("/summary/insights?range=last-30-days");

  await expect(trendCard(page)).toContainText("Not enough data yet");
  await expect(trendCard(page)).toContainText("3 of 7 days logged so far");
  await expect(page.getByTestId("trend-line")).toHaveCount(0);
});

test("every average is also available as a table", async ({ page }) => {
  await arrangeFalling();
  await page.goto("/summary/insights?range=last-30-days");

  await page.getByText("View as a table").click();

  const rows = page
    .getByRole("table", { name: "7-day average by day" })
    .getByRole("row");
  await expect(rows).toHaveCount(25); // header + 24 Days with a full window
  await expect(rows.nth(1)).toContainText("Sun 11 Oct");
});

// Toast 3 x 2 portions of 110 = 660, Rice 2 x 130 = 260, and an Archived Pie 300: 1,220 in all.
async function arrangeTopFoods() {
  const gus = await startFresh();
  const toast = await seedFood(gus, {
    name: "Toast",
    portion: "1 slice",
    calories: 110,
  });
  const rice = await seedFood(gus, {
    name: "Rice",
    portion: "100 g",
    calories: 130,
  });
  const pie = await seedFood(gus, {
    name: "Pie",
    portion: "1 slice",
    calories: 300,
  });
  await seedEntries(gus, [
    { foodId: toast.id, day: "2026-10-20", quantity: 2 },
    { foodId: toast.id, day: "2026-10-27", quantity: 2 },
    { foodId: toast.id, day: "2026-11-02", quantity: 2 },
    { foodId: rice.id, day: "2026-10-28", quantity: 2 },
    { foodId: pie.id, day: "2026-10-29", quantity: 1 },
  ]);
  const archived = await gus
    .from("foods")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", pie.id);
  if (archived.error) throw new Error(archived.error.message);
  return { toast, rice, pie };
}

const topFoodsCard = (page: Page) =>
  page.getByRole("region", { name: "Top foods" });
const topFoodRows = (page: Page) =>
  topFoodsCard(page)
    .getByRole("list", { name: "Top foods" })
    .getByRole("listitem");

test("Top foods ranks Foods by calories, with each share, and includes Archived ones", async ({
  page,
}) => {
  await arrangeTopFoods();

  await page.goto("/summary/insights");

  const rows = topFoodRows(page);
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Toast");
  await expect(rows.nth(0)).toContainText("660 kcal");
  await expect(rows.nth(0)).toContainText("54%");
  await expect(rows.nth(0)).toContainText("3 times");
  await expect(rows.nth(1)).toContainText("Pie");
  await expect(rows.nth(1)).toContainText("Archived");
  await expect(rows.nth(1)).toContainText("25%");
  await expect(rows.nth(1)).toContainText("1 time");
  await expect(rows.nth(2)).toContainText("Rice");
  await expect(rows.nth(2)).toContainText("21%");
});

test("Top foods can rank by how often Foods were logged", async ({ page }) => {
  await arrangeTopFoods();
  await page.goto("/summary/insights");
  await expect(topFoodRows(page).first()).toContainText("Toast");

  await topFoodsCard(page)
    .getByRole("button", { name: "Times logged" })
    .click();

  // Toast three times; Rice and Pie once each, and ties go to the one with more calories.
  await expect(topFoodRows(page).nth(0)).toContainText("Toast");
  await expect(topFoodRows(page).nth(1)).toContainText("Pie");
  await expect(topFoodRows(page).nth(2)).toContainText("Rice");
  await expect(
    topFoodsCard(page).getByRole("button", { name: "Times logged" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("tapping a Food in Top foods opens it in the Food List", async ({
  page,
}) => {
  await arrangeTopFoods();
  await page.goto("/summary/insights");

  await topFoodRows(page).first().getByRole("link").click();

  await expect(page).toHaveURL("/foods");
  await expect(page.getByRole("heading", { name: "Edit food" })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Toast");
});

test("tapping an Archived Food in Top foods goes to Archived foods", async ({
  page,
}) => {
  await arrangeTopFoods();
  await page.goto("/summary/insights");

  await topFoodRows(page).nth(1).getByRole("link").click();

  await expect(page).toHaveURL("/foods/archived");
  await expect(
    page.getByRole("heading", { name: "Archived foods" }),
  ).toBeVisible();
});

test("Top foods says so when nothing was logged in the Period", async ({
  page,
}) => {
  await startFresh();

  await page.goto("/summary/insights");

  await expect(topFoodsCard(page)).toContainText(
    "Nothing logged in this period",
  );
});

test("Top foods follows the chosen range", async ({ page }) => {
  await arrangeTopFoods();

  await page.goto("/summary/insights?range=this-week");

  // This week (from Mon 2 Nov) holds only Toast's Entry on the 2nd.
  await expect(topFoodRows(page)).toHaveCount(1);
  await expect(topFoodRows(page).first()).toContainText("220 kcal");
  await expect(topFoodRows(page).first()).toContainText("100%");
});
