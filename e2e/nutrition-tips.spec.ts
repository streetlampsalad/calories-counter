import { expect, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { adminClient, userClient } from "./support/db";
import { seedEntry, seedFood } from "./support/seed";

// Nutrition tips (spec 219), The server asks the fake tips writer
// (NUTRITION_TIPS=fake), never Gemini. liv is the seeded Owner. The route reads today from the server's clock, so last week is the real one.
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

async function arrange(days: number) {
  const liv = await userClient("liv");
  const week = lastWeekDays();
  // No set kept from an earlier run.
  await liv.from("nutrition_tips").delete().eq("week_start", week[0]);
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

// A User cannot reset their own allowance, so the admin client clears liv's tries before each run
// (and each CI retry), which spend 2 of the 3 a day.
test.beforeAll(async () => {
  const liv = await userClient("liv");
  const { data } = await liv.auth.getUser();
  if (!data.user) throw new Error("liv is not signed in");
  const { error } = await adminClient()
    .from("ai_usage")
    .delete()
    .eq("user_id", data.user.id)
    .eq("kind", "tips");
  if (error) throw error;
});

test.afterAll(async () => {
  const liv = await userClient("liv");
  const week = lastWeekDays();
  await liv.from("entries").delete().gte("day", week[0]).lte("day", week[6]);
  await liv.from("nutrition_tips").delete().eq("week_start", week[0]);
});

test("get tips for last week with 3 Logged Days (US1.1, US1.4)", async ({
  page,
}) => {
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

test("reopening Summary shows the kept tips with Ask again, and Ask again replaces them (US2.1, US2.2)", async ({
  page,
}) => {
  // Serial: reopens Summary on the set the test above got and kept.

  await page.goto("/summary");
  const card = page.getByRole("region", { name: "Nutrition tips" });
  await expect(card.getByRole("listitem")).toHaveCount(2);
  await expect(card.locator("strong").first()).toHaveText("Omega-3");
  const askAgain = card.getByRole("button", { name: "Ask again" });
  await expect(askAgain).toBeVisible();
  expect((await askAgain.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(card.getByRole("button", { name: "Get tips" })).toHaveCount(0);

  const asked = page.waitForResponse("**/api/nutrition-tips");
  await askAgain.click();
  expect((await asked).status()).toBe(200);
  await expect(askAgain).toBeEnabled();
  await expect(card.getByRole("listitem")).toHaveCount(2);

  // One set per User per week, however many times they asked.
  const liv = await userClient("liv");
  const { data } = await liv
    .from("nutrition_tips")
    .select("week_start")
    .eq("week_start", lastWeekDays()[0]);
  expect(data).toHaveLength(1);
});

test("fewer than 3 Logged Days shows no button (US1.3)", async ({ page }) => {
  await arrange(2);

  await page.goto("/summary");
  const card = page.getByRole("region", { name: "Nutrition tips" });
  await expect(
    card.getByText("Log food on at least 3 days in a week to get tips."),
  ).toBeVisible();
  await expect(card.getByRole("button")).toHaveCount(0);
});
