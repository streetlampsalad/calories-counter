import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";
import { resetSettings, resetUser } from "./support/seed";

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
    .getByRole("link", { name: "Summary", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL("/summary?period=last-month");
});

test("a long range leads back to This week, since the Summary has no such Period", async ({
  page,
}) => {
  await startFresh();
  await page.goto("/summary/insights?range=12-months");

  await page
    .getByRole("link", { name: "Summary", exact: true })
    .first()
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
