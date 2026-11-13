import { expect, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";
import { seedEntry, seedFood } from "./support/seed";

// Nutrition tips (spec 219), behind Toggle feature-218. The server asks the fake tips writer
// (NUTRITION_TIPS=fake), never Gemini. liv is the seeded Owner, who may switch a Toggle in Testing
// for themselves. The route reads today from the server's clock, so last week is the real one.
test.describe.configure({ mode: "serial" });
test.use({ storageState: authFile("liv"), timezoneId: "Australia/Sydney" });

const DAY_MS = 24 * 60 * 60 * 1000;
const toDay = (date: Date) => date.toISOString().slice(0, 10);

// Last week's Days for a week that starts on Monday, from today in Sydney.
function lastWeekDays() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
  }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  const start = new Date(date.getTime() - (sinceMonday + 7) * DAY_MS);
  return Array.from({ length: 7 }, (_, i) =>
    toDay(new Date(start.getTime() + i * DAY_MS)),
  );
}

async function setToggle(on: boolean) {
  const liv = await userClient("liv");
  const { error } = await liv
    .from("toggle_overrides")
    .upsert(
      { toggle_key: "feature-218", enabled: on },
      { onConflict: "toggle_key,user_id" },
    );
  if (error) throw error;
}

async function arrange(days: number) {
  const liv = await userClient("liv");
  const week = lastWeekDays();
  const { error } = await liv
    .from("user_settings")
    .upsert({ week_starts_on: 1 }, { onConflict: "user_id" });
  if (error) throw error;
  await liv.from("entries").delete().gte("day", week[0]).lte("day", week[6]);
  const food = await seedFood(liv, { portion: "1 slice", calories: 100 });
  for (const day of week.slice(0, days)) {
    await seedEntry(liv, { foodId: food.id, day, quantity: 1 });
  }
}

test.afterAll(async () => {
  const liv = await userClient("liv");
  const week = lastWeekDays();
  await liv.from("entries").delete().gte("day", week[0]).lte("day", week[6]);
});

test("get tips for last week with 3 Logged Days (US1.1, US1.4)", async ({
  page,
}) => {
  await setToggle(true);
  await arrange(3);

  await page.goto("/summary?period=this-month");
  const card = page.getByRole("region", { name: "Nutrition tips" });
  const button = card.getByRole("button", { name: "Get tips" });
  await expect(button).toBeVisible();
  expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);

  await button.click();
  await expect(card.getByRole("listitem")).toHaveCount(2);
  await expect(card.locator("strong").first()).toHaveText("Omega-3");
  await expect(
    card.getByText(
      "AI guesses from your food names, not medical or dietary advice.",
    ),
  ).toBeVisible();
});

test("fewer than 3 Logged Days shows no button (US1.3)", async ({ page }) => {
  await setToggle(true);
  await arrange(2);

  await page.goto("/summary");
  const card = page.getByRole("region", { name: "Nutrition tips" });
  await expect(
    card.getByText("Log food on at least 3 days in a week to get tips."),
  ).toBeVisible();
  await expect(card.getByRole("button")).toHaveCount(0);
});

test("with the Toggle off there is no card and the route answers 404 (US1.2)", async ({
  page,
}) => {
  await setToggle(false);

  await page.goto("/summary");
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Nutrition tips" }),
  ).toHaveCount(0);

  const response = await page.request.post("/api/nutrition-tips", {
    data: { weekStart: lastWeekDays()[0] },
  });
  expect(response.status()).toBe(404);
});
