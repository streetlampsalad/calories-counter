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
