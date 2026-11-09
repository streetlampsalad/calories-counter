import { expect, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";
import { clearDay, seedFood } from "./support/seed";

// Meal times (spec 174), behind Toggle feature-173. liv is the seeded Owner, who may switch a
// Toggle in Testing for themselves.
test.describe.configure({ mode: "serial" });
test.use({ storageState: authFile("liv") });

const DAY = "2001-06-10";

async function setToggle(on: boolean) {
  const liv = await userClient("liv");
  const { error } = await liv
    .from("toggle_overrides")
    .upsert(
      { toggle_key: "feature-173", enabled: on },
      { onConflict: "toggle_key,user_id" },
    );
  if (error) throw error;
}

test.beforeEach(async () => {
  await setToggle(true);
});

test("add an Entry with a chosen Meal time and see it on its row (US1.1, US1.3, US1.4)", async ({
  page,
}) => {
  const liv = await userClient("liv");
  await clearDay(liv, DAY);
  const food = await seedFood(liv, { portion: "1 slice", calories: 100 });

  await page.goto(`/?day=${DAY}`);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Add to your day" });
  await expect(picker.getByRole("button", { name: "Dinner" })).toBeVisible();
  // Not today, so no chip starts chosen.
  await expect(picker.getByRole("button", { name: "Lunch" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await picker.getByRole("button", { name: "Lunch" }).click();
  await picker.getByRole("button", { name: new RegExp(food.name) }).click();
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/rest/v1/entries"),
  );
  await picker.getByRole("button", { name: "Add 1", exact: true }).click();
  await saved;

  await expect(
    page
      .getByRole("list", { name: "Entries" })
      .getByRole("listitem")
      .filter({ hasText: food.name }),
  ).toContainText("Lunch");
});

test("two Meal times show two groups with their calories (US2.1, US2.2, US2.4)", async ({
  page,
}) => {
  const liv = await userClient("liv");
  await clearDay(liv, DAY);
  const food = await seedFood(liv, { portion: "1 slice", calories: 100 });
  for (const mealTime of ["lunch", "breakfast"]) {
    const { error } = await liv
      .from("entries")
      .insert({ day: DAY, food_id: food.id, quantity: 1, meal_time: mealTime });
    if (error) throw error;
  }

  await page.goto(`/?day=${DAY}`);

  const headings = page.getByRole("heading", { level: 3 });
  await expect(headings).toHaveText(["Breakfast100 kcal", "Lunch100 kcal"]);
  await expect(page.getByRole("heading", { name: /Dinner/ })).toHaveCount(0);
});

test("change a Meal time and see the Entry move group (US3.1, US3.2)", async ({
  page,
}) => {
  const liv = await userClient("liv");
  await clearDay(liv, DAY);
  const food = await seedFood(liv, { portion: "1 slice", calories: 100 });
  const { error } = await liv
    .from("entries")
    .insert({ day: DAY, food_id: food.id, quantity: 1, meal_time: "lunch" });
  if (error) throw error;
  // A second tagged Entry keeps the Day grouped when the first one is cleared.
  const second = await seedFood(liv, { portion: "1 cup", calories: 50 });
  const { error: secondError } = await liv.from("entries").insert({
    day: DAY,
    food_id: second.id,
    quantity: 1,
    meal_time: "breakfast",
  });
  if (secondError) throw secondError;

  await page.goto(`/?day=${DAY}`);
  await page
    .getByRole("list", { name: "Entries" })
    .getByRole("listitem")
    .filter({ hasText: food.name })
    .getByRole("button")
    .click();
  const sheet = page.getByRole("dialog", { name: "Edit entry" });
  await expect(sheet.getByRole("button", { name: "Lunch" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await sheet.getByRole("button", { name: "Dinner" }).click();

  const headings = page.getByRole("heading", { level: 3 });
  await expect(headings).toHaveText(["Breakfast50 kcal", "Dinner100 kcal"]);

  await page
    .getByRole("list", { name: "Entries" })
    .getByRole("listitem")
    .filter({ hasText: food.name })
    .getByRole("button")
    .click();
  await page
    .getByRole("dialog", { name: "Edit entry" })
    .getByRole("button", { name: "Dinner" })
    .click();
  await expect(headings).toHaveText(["Breakfast50 kcal", "Other100 kcal"]);
});
