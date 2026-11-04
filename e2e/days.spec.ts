import { expect, type Page, test } from "@playwright/test";
import { userClient } from "./support/db";
import { clearDay, seedEntry, seedFood } from "./support/seed";

// A date on this machine's calendar, which is the one the browser uses.
const daysAgo = (count: number) => {
  const date = new Date();
  date.setDate(date.getDate() - count);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const daysAhead = (count: number) => daysAgo(-count);

const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const entries = (page: Page) =>
  page.getByRole("list", { name: "Entries" }).getByRole("listitem");
const picker = (page: Page) =>
  page.getByRole("dialog", { name: "Add to your day" });

async function logOnCurrentDay(page: Page, foodName: string, label: string) {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await picker(page)
    .getByRole("searchbox", { name: "Search foods" })
    .fill(foodName);
  await picker(page)
    .getByRole("button", { name: new RegExp(foodName) })
    .click();
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/rest/v1/entries"),
  );
  await picker(page).getByRole("button", { name: label, exact: true }).click();
  await saved;
}

test("arrows step a Day at a time, and the URL follows", async ({ page }) => {
  await page.goto("/");
  await expect(heading(page)).toHaveText("Today");
  await expect(page.getByRole("button", { name: "Next day" })).toBeEnabled();

  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(heading(page)).toHaveText("Yesterday");
  await expect(page).toHaveURL(/\/\?day=\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByRole("button", { name: "Next day" })).toBeEnabled();

  await page.getByRole("button", { name: "Next day" }).click();
  await expect(heading(page)).toHaveText("Today");
  await expect(page).toHaveURL("/");
});

test("two quick taps go back two Days", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Previous day" }).click();
  await page.getByRole("button", { name: "Previous day" }).click();

  // The Day shows at once; the URL follows a moment later.
  await expect(heading(page)).not.toHaveText(/^(Today|Yesterday)$/);
  await expect(page).toHaveURL(new RegExp(`/?day=${daysAgo(2)}$`));
});

test("the back button returns through the Days that were visited", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(page).toHaveURL(new RegExp(`/?day=${daysAgo(1)}$`));
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(page).toHaveURL(new RegExp(`/?day=${daysAgo(2)}$`));

  await page.goBack();
  await expect(heading(page)).toHaveText("Yesterday");

  await page.goBack();
  await expect(heading(page)).toHaveText("Today");
});

test("the date picker jumps to any past Day", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Pick a day").fill("2001-07-04");

  await expect(heading(page)).toHaveText("Wed 4 Jul 2001");
  await expect(page).toHaveURL("/?day=2001-07-04");
});

test("the date picker will not go beyond the last Day that can be planned", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Pick a day")).toHaveAttribute(
    "max",
    daysAhead(14),
  );

  await page.getByLabel("Pick a day").fill(daysAhead(15));

  await expect(heading(page)).toHaveText("Today");
  await expect(page).toHaveURL("/");
});

test("the date picker goes to a Day to plan", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Pick a day").fill(daysAhead(14));

  await expect(page).toHaveURL(`/?day=${daysAhead(14)}`);
});

test("Days can be planned up to 14 ahead, and no further", async ({ page }) => {
  await page.goto(`/?day=${daysAhead(13)}`);
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(page).toHaveURL(`/?day=${daysAhead(14)}`);
  await expect(page.getByRole("button", { name: "Next day" })).toBeDisabled();

  // A link past the limit lands on today.
  await page.goto(`/?day=${daysAhead(15)}`);
  await expect(heading(page)).toHaveText("Today");
});

test("planning tomorrow: the total says Planned, and the Entry is for tomorrow only", async ({
  page,
}) => {
  const ada = await userClient("ada");
  const food = await seedFood(ada, { portion: "1 slice", calories: 100 });
  await page.goto("/");
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(heading(page)).toHaveText("Tomorrow");
  await expect(
    page.getByRole("region", { name: "Planned total" }),
  ).toBeVisible();

  await logOnCurrentDay(page, food.name, "Add 1");

  await expect(
    page.getByText(`Planned 1 × ${food.name} for tomorrow`),
  ).toBeVisible();
  await expect(entries(page).filter({ hasText: food.name })).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Planned total" }),
  ).toContainText("100");

  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(heading(page)).toHaveText("Today");
  await expect(page.getByRole("region", { name: "Daily total" })).toBeVisible();
  await expect(entries(page).filter({ hasText: food.name })).toHaveCount(0);

  const { data } = await ada
    .from("entries")
    .select("day")
    .eq("food_id", food.id);
  expect(data).toEqual([{ day: daysAhead(1) }]);
  await ada.from("entries").delete().eq("food_id", food.id);
});

test("a later planned Day names its date in the toast", async ({ page }) => {
  const ada = await userClient("ada");
  const food = await seedFood(ada, { portion: "1 slice", calories: 100 });
  await page.goto(`/?day=${daysAhead(3)}`);
  await expect(
    page.getByRole("region", { name: "Planned total" }),
  ).toBeVisible();

  await logOnCurrentDay(page, food.name, "Add 1");

  await expect(
    page.getByText(
      new RegExp(`^Planned 1 × ${food.name} for \\w{3} \\d{1,2} \\w{3}`),
    ),
  ).toBeVisible();
  await ada.from("entries").delete().eq("food_id", food.id);
});

test.describe("when a planned Day arrives", () => {
  test.use({ timezoneId: "Australia/Sydney" });

  test("its Entries are ordinary Entries and count in the Daily total", async ({
    page,
  }) => {
    const ada = await userClient("ada");
    await clearDay(ada, "2026-11-04");
    const food = await seedFood(ada, { portion: "1 slice", calories: 120 });
    await seedEntry(ada, { foodId: food.id, day: "2026-11-04", quantity: 2 });

    // The day before: it is planned.
    await page.clock.setFixedTime(new Date("2026-11-03T02:00:00Z"));
    await page.goto("/?day=2026-11-04");
    await expect(heading(page)).toHaveText("Tomorrow");
    await expect(
      page.getByRole("region", { name: "Planned total" }),
    ).toContainText("240");

    // The day itself: the same Entry, with nothing done to it.
    await page.clock.setFixedTime(new Date("2026-11-04T02:00:00Z"));
    await page.goto("/");
    await expect(heading(page)).toHaveText("Today");
    await expect(
      page.getByRole("region", { name: "Daily total" }),
    ).toContainText("240");
    await expect(entries(page).filter({ hasText: food.name })).toHaveCount(1);
    await clearDay(ada, "2026-11-04");
  });
});

test("a Day can be opened directly from a link", async ({ page }) => {
  await page.goto("/?day=2001-07-05");

  await expect(heading(page)).toHaveText("Thu 5 Jul 2001");
});

test("logging while on a past Day puts the Entry on that Day, not today", async ({
  page,
}) => {
  const ada = await userClient("ada");
  const food = await seedFood(ada, { portion: "1 slice", calories: 100 });
  await page.goto("/");
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(heading(page)).toHaveText("Yesterday");

  await logOnCurrentDay(page, food.name, "Add 1");
  await expect(entries(page).filter({ hasText: food.name })).toHaveCount(1);

  await page.getByRole("button", { name: "Next day" }).click();
  await expect(heading(page)).toHaveText("Today");
  await expect(page.getByRole("region", { name: "Daily total" })).toBeVisible();
  await expect(entries(page).filter({ hasText: food.name })).toHaveCount(0);

  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(entries(page).filter({ hasText: food.name })).toHaveCount(1);
});

test.describe("a Day is the device's calendar date, not UTC", () => {
  // Auckland is UTC+13 in November: just after midnight there is still the day before in UTC.
  test.use({ timezoneId: "Pacific/Auckland" });

  test("an Entry logged at 12:30 am lands on the new local date", async ({
    page,
  }) => {
    const ada = await userClient("ada");
    const food = await seedFood(ada, { portion: "1 slice", calories: 100 });
    // 2026-11-04 00:30 in Auckland is 2026-11-03 11:30 UTC.
    await page.clock.setFixedTime(new Date("2026-11-03T11:30:00Z"));
    await page.goto("/");
    await expect(heading(page)).toHaveText("Today");

    await logOnCurrentDay(page, food.name, "Add 1");

    const { data } = await ada
      .from("entries")
      .select("day")
      .eq("food_id", food.id);
    expect(data).toEqual([{ day: "2026-11-04" }]);
    await ada.from("entries").delete().eq("food_id", food.id);
  });
});

test("the Day header is easy to use on a phone", async ({ page }) => {
  await page.goto("/");

  for (const name of ["Previous day", "Next day"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box?.width, name).toBeGreaterThanOrEqual(44);
    expect(box?.height, name).toBeGreaterThanOrEqual(44);
  }
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
});
