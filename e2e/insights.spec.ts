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
