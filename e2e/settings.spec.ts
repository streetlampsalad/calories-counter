import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";
import { resetSettings, resetUser, seedEntry, seedFood } from "./support/seed";

// Settings are read by every screen, so these tests use eve alone, one at a time.
test.describe.configure({ mode: "serial" });
test.use({ storageState: authFile("eve") });

const goalDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Daily goal" });
const total = (page: Page) => page.getByRole("region", { name: "Daily total" });

// The UI updates before the server answers, so tests that reload wait for the write first.
const settingsWritten = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() !== "GET" &&
      response.url().includes("/rest/v1/user_settings"),
  );

async function startFresh() {
  const eve = await userClient("eve");
  await resetUser(eve);
  await resetSettings(eve);
  return eve;
}

async function setGoal(page: Page, goal: string) {
  await page.getByRole("button", { name: /^Daily goal:/ }).click();
  await goalDialog(page).getByLabel("Calories per day").fill(goal);
  await goalDialog(page).getByRole("button", { name: "Save goal" }).click();
}

async function logDay(day: string, calories: number, quantity = 1) {
  const eve = await userClient("eve");
  const food = await seedFood(eve, { portion: "1 serve", calories });
  await seedEntry(eve, { foodId: food.id, day, quantity });
}

test("a new User has no Goal", async ({ page }) => {
  await startFresh();

  await page.goto("/settings");

  await expect(
    page.getByRole("button", { name: "Daily goal: not set. Change" }),
  ).toBeVisible();
  await expect(page.getByText("Not set")).toBeVisible();
});

test("setting a Goal shows it in Settings and keeps it after a reload", async ({
  page,
}) => {
  await startFresh();
  await page.goto("/settings");

  const saved = settingsWritten(page);
  await setGoal(page, "2200");

  await expect(page.getByText("2,200 kcal")).toBeVisible();
  await saved;
  await page.reload();
  await expect(page.getByText("2,200 kcal")).toBeVisible();
});

test("the Goal sheet opens with the numeric keypad focused", async ({
  page,
}) => {
  await startFresh();
  await page.goto("/settings");

  await page.getByRole("button", { name: /^Daily goal:/ }).click();

  await expect(goalDialog(page).getByLabel("Calories per day")).toBeFocused();
  await expect(goalDialog(page).getByLabel("Calories per day")).toHaveAttribute(
    "inputmode",
    "numeric",
  );
});

test("a Goal outside 500 to 10,000 is refused with a message", async ({
  page,
}) => {
  await startFresh();
  await page.goto("/settings");

  await setGoal(page, "499");

  await expect(
    page.getByText("Enter a goal between 500 and 10,000 calories"),
  ).toBeVisible();
  await expect(goalDialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Not set")).toBeVisible();
});

test("Today shows the total against the Goal, with what is left", async ({
  page,
}) => {
  await startFresh();
  await logDay("2001-08-01", 100, 2);
  await page.goto("/settings");
  const saved = settingsWritten(page);
  await setGoal(page, "2200");
  await saved;

  await page.goto("/?day=2001-08-01");

  await expect(total(page)).toContainText("200 / 2,200");
  await expect(total(page)).toContainText("2,000 left");
  const bar = page.getByRole("progressbar", {
    name: "Progress towards your daily goal",
  });
  await expect(bar).toHaveAttribute("aria-valuenow", "200");
  await expect(bar).toHaveAttribute("aria-valuemax", "2200");
});

test("a Day over the Goal says by how much", async ({ page }) => {
  await startFresh();
  await logDay("2001-08-02", 300, 2); // 600 kcal
  await page.goto("/settings");
  const saved = settingsWritten(page);
  await setGoal(page, "500");
  await saved;

  await page.goto("/?day=2001-08-02");

  await expect(total(page)).toContainText("600 / 500");
  await expect(total(page)).toContainText("100 over");
});

test("clearing the Goal takes the comparison away everywhere", async ({
  page,
}) => {
  await startFresh();
  await logDay("2001-08-03", 100);
  await page.goto("/settings");
  let saved = settingsWritten(page);
  await setGoal(page, "2000");
  await saved;
  await page.goto("/?day=2001-08-03");
  await expect(page.getByRole("progressbar")).toBeVisible();

  await page.goto("/settings");
  saved = settingsWritten(page);
  await page.getByRole("button", { name: /^Daily goal:/ }).click();
  await goalDialog(page).getByRole("button", { name: "Clear goal" }).click();
  await expect(page.getByText("Not set")).toBeVisible();
  await saved;

  await page.goto("/?day=2001-08-03");
  await expect(total(page)).toContainText("100");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(total(page)).not.toContainText("/");
});

test("a failed save puts the old Goal back and offers to retry", async ({
  page,
}) => {
  await startFresh();
  await page.route("**/rest/v1/user_settings*", (route) =>
    route.request().method() !== "GET"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: "{}",
        })
      : route.continue(),
  );
  await page.goto("/settings");

  await setGoal(page, "2200");

  await expect(page.getByText("Couldn't save your settings")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByText("Not set")).toBeVisible();
});

test("Settings fits a phone, and the Goal row is easy to hit", async ({
  page,
}) => {
  await startFresh();
  await page.goto("/settings");

  const box = await page
    .getByRole("button", { name: /^Daily goal:/ })
    .boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(56);
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
});

test("weeks start on Monday until changed", async ({ page }) => {
  await startFresh();

  await page.goto("/settings");

  await expect(page.getByRole("button", { name: "Monday" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Sunday" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("choosing Sunday is saved straight away and kept after a reload, and Monday can be chosen again", async ({
  page,
}) => {
  await startFresh();
  await page.goto("/settings");

  let saved = settingsWritten(page);
  await page.getByRole("button", { name: "Sunday" }).click();
  await expect(page.getByRole("button", { name: "Sunday" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await saved;
  await page.reload();
  await expect(page.getByRole("button", { name: "Sunday" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  saved = settingsWritten(page);
  await page.getByRole("button", { name: "Monday" }).click();
  await expect(page.getByRole("button", { name: "Monday" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await saved;
  await page.reload();
  await expect(page.getByRole("button", { name: "Monday" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("changing the week start does not disturb the Goal, and vice versa", async ({
  page,
}) => {
  await startFresh();
  await page.goto("/settings");
  let saved = settingsWritten(page);
  await setGoal(page, "1900");
  await expect(page.getByText("1,900 kcal")).toBeVisible();
  await saved;

  saved = settingsWritten(page);
  await page.getByRole("button", { name: "Sunday" }).click();
  await saved;

  await page.reload();
  await expect(page.getByText("1,900 kcal")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sunday" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a failed week-start save goes back to the old choice", async ({
  page,
}) => {
  await startFresh();
  await page.route("**/rest/v1/user_settings*", (route) =>
    route.request().method() !== "GET"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: "{}",
        })
      : route.continue(),
  );
  await page.goto("/settings");

  await page.getByRole("button", { name: "Sunday" }).click();

  await expect(page.getByText("Couldn't save your settings")).toBeVisible();
  await expect(page.getByRole("button", { name: "Monday" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
