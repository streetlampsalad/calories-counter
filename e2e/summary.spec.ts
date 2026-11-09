import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";
import { resetSettings, resetUser, seedEntry, seedFood } from "./support/seed";

// Summaries depend on a whole window of a User's history, so these use fay alone, one at a time,
// on a frozen Tuesday (3 Nov 2026, 1 pm in Sydney) so every number below is known in advance.
test.describe.configure({ mode: "serial" });
test.use({ storageState: authFile("fay"), timezoneId: "Australia/Sydney" });

const NOW = new Date("2026-11-03T02:00:00Z");
const totals = (page: Page) =>
  page.getByRole("region", { name: "Summary totals" });
const chip = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Period" }).getByRole("link", { name });

// Logged Days: 2 Oct 1,000 | 26 Oct 2,000 | 27 Oct 1,800 | 29 Oct 2,200 | 2 Nov 1,500 | 3 Nov 1,000
async function arrange(settings?: {
  goal?: number | null;
  weekStartsOn?: 0 | 1;
}) {
  const fay = await userClient("fay");
  await resetUser(fay);
  await resetSettings(fay);
  const hundred = await seedFood(fay, {
    name: "Hundred",
    portion: "1 serve",
    calories: 100,
  });
  const fifty = await seedFood(fay, {
    name: "Fifty",
    portion: "1 serve",
    calories: 50,
  });
  await seedEntry(fay, { foodId: hundred.id, day: "2026-10-02", quantity: 10 });
  await seedEntry(fay, { foodId: hundred.id, day: "2026-10-26", quantity: 20 });
  await seedEntry(fay, { foodId: hundred.id, day: "2026-10-27", quantity: 18 });
  await seedEntry(fay, { foodId: hundred.id, day: "2026-10-29", quantity: 20 });
  await seedEntry(fay, { foodId: fifty.id, day: "2026-10-29", quantity: 4 });
  await seedEntry(fay, { foodId: hundred.id, day: "2026-11-02", quantity: 15 });
  await seedEntry(fay, { foodId: hundred.id, day: "2026-11-03", quantity: 10 });
  if (settings) {
    const { error } = await fay.from("user_settings").upsert(
      {
        ...(settings.goal !== undefined && {
          daily_goal_calories: settings.goal,
        }),
        ...(settings.weekStartsOn !== undefined && {
          week_starts_on: settings.weekStartsOn,
        }),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
  }
  return { fay, hundred };
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test("opens on This week with the headline numbers", async ({ page }) => {
  await arrange();

  await page.goto("/summary");

  await expect(
    page.getByRole("heading", { name: "Summary", level: 1 }),
  ).toBeVisible();
  await expect(chip(page, "This week")).toHaveAttribute("aria-current", "true");
  await expect(page.getByText("2 – 3 Nov")).toBeVisible();
  await expect(totals(page)).toContainText("2,500");
  await expect(totals(page)).toContainText("Average 1,250 kcal per logged day");
  await expect(totals(page)).toContainText("2 of 2 days logged");
});

test("Entries planned for later Days are in no Period", async ({ page }) => {
  const { fay, hundred } = await arrange();
  await seedEntry(fay, { foodId: hundred.id, day: "2026-11-04", quantity: 20 });
  await seedEntry(fay, { foodId: hundred.id, day: "2026-11-10", quantity: 20 });

  await page.goto("/summary");
  await expect(totals(page)).toContainText("2,500");
  await expect(totals(page)).toContainText("2 of 2 days logged");

  await chip(page, "This month").click();
  await expect(totals(page)).toContainText("2,500");
  await expect(totals(page)).toContainText("2 of 3 days logged");

  await chip(page, "Last 30 days").click();
  await expect(totals(page)).toContainText("8,500");
  await expect(totals(page)).toContainText("5 of 30 days logged");
});

const PERIOD_CASES = [
  {
    chip: "This week",
    url: "this-week",
    range: "2 – 3 Nov",
    total: "2,500",
    average: "1,250",
    logged: "2 of 2 days logged",
  },
  {
    chip: "Last week",
    url: "last-week",
    range: "26 Oct – 1 Nov",
    total: "6,000",
    average: "2,000",
    logged: "3 of 7 days logged",
  },
  {
    chip: "This month",
    url: "this-month",
    range: "1 – 3 Nov",
    total: "2,500",
    average: "1,250",
    logged: "2 of 3 days logged",
  },
  {
    chip: "Last month",
    url: "last-month",
    range: "1 – 31 Oct",
    total: "7,000",
    average: "1,750",
    logged: "4 of 31 days logged",
  },
  {
    chip: "Last 30 days",
    url: "last-30-days",
    range: "5 Oct – 3 Nov",
    total: "8,500",
    average: "1,700",
    logged: "5 of 30 days logged",
  },
];

for (const c of PERIOD_CASES) {
  test(`${c.chip}: ${c.total} kcal, ${c.logged}`, async ({ page }) => {
    await arrange();
    await page.goto("/summary");

    await chip(page, c.chip).click();

    await expect(page).toHaveURL(new RegExp(`/summary\\?period=${c.url}$`));
    await expect(chip(page, c.chip)).toHaveAttribute("aria-current", "true");
    await expect(page.getByText(c.range, { exact: true })).toBeVisible();
    await expect(totals(page)).toContainText(c.total);
    await expect(totals(page)).toContainText(
      `Average ${c.average} kcal per logged day`,
    );
    await expect(totals(page)).toContainText(c.logged);
  });
}

test("a Period can be opened from a link, and an unknown one falls back to This week", async ({
  page,
}) => {
  await arrange();

  await page.goto("/summary?period=last-month");
  await expect(chip(page, "Last month")).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(totals(page)).toContainText("7,000");

  await page.goto("/summary?period=nonsense");
  await expect(chip(page, "This week")).toHaveAttribute("aria-current", "true");
});

test("weeks follow the week-start setting", async ({ page }) => {
  await arrange({ weekStartsOn: 0 });

  await page.goto("/summary");
  // Sunday-start: this week began Sunday 1 Nov.
  await expect(page.getByText("1 – 3 Nov")).toBeVisible();
  await expect(totals(page)).toContainText("2 of 3 days logged");

  await chip(page, "Last week").click();
  await expect(page.getByText("25 – 31 Oct")).toBeVisible();
  await expect(totals(page)).toContainText("6,000");
  await expect(totals(page)).toContainText("3 of 7 days logged");
});

test("with a Goal, shows how the average compares and how many days went over", async ({
  page,
}) => {
  await arrange({ goal: 2000 });

  await page.goto("/summary?period=last-30-days");
  await expect(totals(page)).toContainText("300 kcal under goal on average");
  await expect(totals(page)).toContainText("Over goal on 1 of 5 logged days");

  await chip(page, "Last week").click();
  await expect(totals(page)).toContainText("Right on your goal on average");
  await expect(totals(page)).toContainText("Over goal on 1 of 3 logged days");
});

test("without a Goal, says nothing about one", async ({ page }) => {
  await arrange();

  await page.goto("/summary?period=last-week");

  await expect(totals(page)).toContainText("6,000");
  await expect(totals(page)).not.toContainText(/goal/i);
});

test("a Period with nothing logged says so and points to Today", async ({
  page,
}) => {
  const { fay } = await arrange();
  await fay.from("entries").delete().not("id", "is", null);

  await page.goto("/summary");

  await expect(page.getByText("Nothing logged in this period")).toBeVisible();
  await expect(totals(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Go to Today" }).click();
  await expect(page).toHaveURL("/");
});

test("editing a Food changes the totals of every Period it appears in (ADR 0001)", async ({
  page,
}) => {
  const { fay, hundred } = await arrange();
  await page.goto("/summary?period=last-30-days");
  await expect(totals(page)).toContainText("8,500");

  // Doubling Hundred to 200 kcal changes every Day it was eaten on, with no re-entry.
  await fay.from("foods").update({ calories: 200 }).eq("id", hundred.id);
  await page.reload();

  // Last 30 days: Hundred x (20 + 18 + 20 + 15 + 10) = 83 portions x 200, plus Fifty x 4 x 50 = 16,800.
  await expect(totals(page)).toContainText("16,800");
});

test("changing the week start in Settings updates the Summary without a reload", async ({
  page,
}) => {
  await arrange();
  await page.goto("/summary");
  await expect(totals(page)).toContainText("2 of 2 days logged");

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Settings" })
    .click();
  await page.getByRole("link", { name: /Tracking/ }).click();
  const written = page.waitForResponse(
    (response) =>
      response.request().method() !== "GET" &&
      response.url().includes("/rest/v1/user_settings"),
  );
  await page.getByRole("button", { name: "Sunday" }).click();
  await written;
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Summary" })
    .click();

  await expect(page.getByText("1 – 3 Nov")).toBeVisible();
  await expect(totals(page)).toContainText("2 of 3 days logged");
});

test("the Summary tab opens the Summary", async ({ page }) => {
  await arrange();
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Summary" })
    .click();

  await expect(page).toHaveURL(/\/summary/);
  await expect(
    page.getByRole("heading", { name: "Summary", level: 1 }),
  ).toBeVisible();
});

test("Period chips are easy to tap, and the screen does not scroll sideways", async ({
  page,
}) => {
  await arrange();
  await page.goto("/summary");
  await expect(totals(page)).toBeVisible();

  const box = await chip(page, "This week").boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
});

const bars = (page: Page) =>
  page.getByRole("list", { name: "Daily calories" }).getByRole("listitem");

test("the chart has a slot for every Day, with bars only for the Days that were logged", async ({
  page,
}) => {
  await arrange();

  await page.goto("/summary?period=last-week");

  await expect(bars(page)).toHaveCount(7);
  await expect(page.getByTestId("bar")).toHaveCount(3);
  await expect(page.getByTestId("axis")).toHaveText("MTWTFSS");
  // The empty slot is still there to tap, and says nothing was logged.
  await expect(
    page.getByRole("link", { name: "Wed 28 Oct: nothing logged" }),
  ).toBeVisible();
});

test("tapping a bar opens that Day", async ({ page }) => {
  await arrange();
  await page.goto("/summary?period=last-week");

  await page.getByRole("link", { name: "Tue 27 Oct: 1,800 kcal" }).click();

  await expect(page).toHaveURL("/?day=2026-10-27");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Tue 27 Oct",
  );
  await expect(page.getByRole("region", { name: "Daily total" })).toContainText(
    "1,800",
  );
});

test("tapping today's bar opens Today", async ({ page }) => {
  await arrange();
  await page.goto("/summary");

  await page.getByRole("link", { name: "Today: 1,000 kcal" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today");
});

test("with a Goal the chart draws the Goal line and marks the Days over it", async ({
  page,
}) => {
  await arrange({ goal: 2000 });

  await page.goto("/summary?period=last-week");

  await expect(page.getByTestId("goal-line")).toContainText("Goal 2,000");
  // Only 29 Oct (2,200) is past the Goal; 26 Oct is exactly on it.
  await expect(page.locator("[data-testid=bar][data-over]")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Thu 29 Oct: 2,200 kcal, 200 over goal" }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Key" })).toContainText(
    "Over goal",
  );
});

test("without a Goal there is no Goal line", async ({ page }) => {
  await arrange();

  await page.goto("/summary?period=last-week");

  await expect(page.getByTestId("bar")).toHaveCount(3);
  await expect(page.getByTestId("goal-line")).toHaveCount(0);
  await expect(page.locator("[data-testid=bar][data-over]")).toHaveCount(0);
});

test("pointing at a bar says which Day and how much, as text", async ({
  page,
}) => {
  await arrange();
  await page.goto("/summary?period=last-week");
  await expect(page.getByTestId("detail")).toHaveText("Tap a day to open it");

  await page.getByRole("link", { name: "Mon 26 Oct: 2,000 kcal" }).hover();

  await expect(page.getByTestId("detail")).toHaveText("Mon 26 Oct: 2,000 kcal");
});

test("the same numbers are available as a table", async ({ page }) => {
  await arrange({ goal: 2000 });
  await page.goto("/summary?period=last-week");

  await page.getByText("View as a table").click();

  const table = page.getByRole("table", { name: "Daily calories" });
  await expect(table.getByRole("row")).toHaveCount(8);
  await expect(table.getByRole("row", { name: /Thu 29 Oct/ })).toContainText(
    "200 over",
  );
  await expect(table.getByRole("row", { name: /Wed 28 Oct/ })).toContainText(
    "Not logged",
  );
  await expect(table.getByRole("row", { name: /Mon 26 Oct/ })).toContainText(
    "On goal",
  );
});

test("an empty Period shows no chart", async ({ page }) => {
  const { fay } = await arrange();
  await fay.from("entries").delete().not("id", "is", null);

  await page.goto("/summary");

  await expect(page.getByText("Nothing logged in this period")).toBeVisible();
  await expect(page.getByRole("list", { name: "Daily calories" })).toHaveCount(
    0,
  );
});

test("a long Period scrolls inside the chart, never the page, and each Day stays tappable", async ({
  page,
}) => {
  await arrange();
  await page.goto("/summary?period=last-30-days");
  await expect(bars(page)).toHaveCount(30);

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
  const box = await bars(page).nth(0).boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(16);
  expect(box?.height).toBeGreaterThanOrEqual(100);
});
