import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";
import { resetBurned, seedEntry, seedFood } from "./support/seed";

// Calories Burned (spec 017) lives in settings and a whole Log, so these tests use kit alone, one
// at a time, and reset everything first.
test.describe.configure({ mode: "serial" });
test.use({ storageState: authFile("kit") });

const dayFromToday = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString("en-CA");
};

const burnedRow = (page: Page) => page.getByRole("button", { name: /^Burned/ });
const sheet = (page: Page) =>
  page.getByRole("dialog", { name: "Calories burned" });
const trackSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Track calories burned" });

// The UI updates before the server answers, so tests that reload wait for the write first.
const burnedWritten = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() !== "GET" &&
      response.url().includes("/rest/v1/calories_burned"),
  );

async function arrange(options: {
  tracking?: boolean;
  entry?: { day: string; calories: number; quantity?: number };
  burned?: { day: string; calories: number };
}) {
  const kit = await userClient("kit");
  await resetBurned(kit);
  if (options.tracking ?? true) {
    const { error } = await kit
      .from("user_settings")
      .upsert({ track_calories_burned: true });
    if (error) throw new Error(error.message);
  }
  let foodId = "";
  if (options.entry) {
    const food = await seedFood(kit, {
      portion: "1 serve",
      calories: options.entry.calories,
    });
    foodId = food.id;
    await seedEntry(kit, {
      foodId,
      day: options.entry.day,
      quantity: options.entry.quantity ?? 1,
    });
  }
  if (options.burned) {
    const { error } = await kit.from("calories_burned").upsert(options.burned);
    if (error) throw new Error(error.message);
  }
  return { kit, foodId };
}

async function setBurned(page: Page, calories: string) {
  await burnedRow(page).click();
  await sheet(page).getByLabel("Calories burned (kcal)").fill(calories);
  const written = burnedWritten(page);
  await sheet(page).getByRole("button", { name: "Save" }).click();
  await written;
}

const PAST = "2001-06-01";

test("nothing about Calories Burned shows until the User turns it on (AC-1, AC-2)", async ({
  page,
}) => {
  await arrange({
    tracking: false,
    entry: { day: PAST, calories: 1840 },
    burned: { day: PAST, calories: 2450 },
  });

  await page.goto(`/?day=${PAST}`);
  await expect(page.getByRole("region", { name: "Daily total" })).toContainText(
    "1,840",
  );
  await expect(burnedRow(page)).toHaveCount(0);
  await expect(page.getByText(/deficit|surplus/i)).toHaveCount(0);

  await page.goto("/settings");
  await expect(trackSwitch(page)).not.toBeChecked();
});

test("turning the switch on shows the Burned row on Today (AC-1, AC-3)", async ({
  page,
}) => {
  await arrange({ tracking: false });
  await page.goto("/settings");
  const written = page.waitForResponse(
    (response) =>
      response.request().method() !== "GET" &&
      response.url().includes("/rest/v1/user_settings"),
  );

  await trackSwitch(page).click();
  await written;

  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Burned so far · Add" }),
  ).toBeVisible();
});

test("a figure shows the Deficit, survives a reload, and a new one replaces it (AC-3, AC-4, AC-5)", async ({
  page,
}) => {
  const { kit } = await arrange({ entry: { day: PAST, calories: 1840 } });
  await page.goto(`/?day=${PAST}`);
  await expect(
    page.getByRole("button", { name: "Burned · Add" }),
  ).toBeVisible();

  await setBurned(page, "2450");

  await expect(
    page.getByRole("button", { name: "Burned 2,450 kcal · 610 kcal deficit" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Burned 2,450 kcal · 610 kcal deficit" }),
  ).toBeVisible();

  await setBurned(page, "2600");

  await expect(
    page.getByRole("button", { name: "Burned 2,600 kcal · 760 kcal deficit" }),
  ).toBeVisible();
  const { data } = await kit.from("calories_burned").select("day, calories");
  expect(data).toEqual([{ day: PAST, calories: 2600 }]);
});

test("more eaten than burned is a Surplus (AC-3)", async ({ page }) => {
  await arrange({
    entry: { day: PAST, calories: 1325, quantity: 2 },
    burned: { day: PAST, calories: 2450 },
  });

  await page.goto(`/?day=${PAST}`);

  await expect(
    page.getByRole("button", { name: "Burned 2,450 kcal · 200 kcal surplus" }),
  ).toBeVisible();
});

test("a figure with nothing logged asks for food instead of claiming a Deficit (AC-3)", async ({
  page,
}) => {
  await arrange({ burned: { day: PAST, calories: 2450 } });

  await page.goto(`/?day=${PAST}`);

  await expect(
    page.getByRole("button", {
      name: "Burned 2,450 kcal · Log food to see your deficit",
    }),
  ).toBeVisible();
});

test("editing a Food's Calories changes past Deficits, as it does totals (AC-5)", async ({
  page,
}) => {
  const { kit, foodId } = await arrange({
    entry: { day: PAST, calories: 1840 },
    burned: { day: PAST, calories: 2450 },
  });
  await page.goto(`/?day=${PAST}`);
  await expect(
    page.getByRole("button", { name: /610 kcal deficit/ }),
  ).toBeVisible();

  const { error } = await kit
    .from("foods")
    .update({ calories: 1640 })
    .eq("id", foodId);
  expect(error).toBeNull();
  await page.reload();

  await expect(
    page.getByRole("button", { name: /810 kcal deficit/ }),
  ).toBeVisible();
});

test("today's row says so far (AC-3)", async ({ page }) => {
  const today = dayFromToday(0);
  await arrange({
    entry: { day: today, calories: 1840 },
    burned: { day: today, calories: 2450 },
  });

  await page.goto("/");

  await expect(
    page.getByRole("button", {
      name: "Burned so far 2,450 kcal · 610 kcal deficit",
    }),
  ).toBeVisible();
});

test("a Day still to come has no Burned row (AC-3)", async ({ page }) => {
  await arrange({});

  await page.goto(`/?day=${dayFromToday(1)}`);

  await expect(
    page.getByRole("region", { name: "Planned total" }),
  ).toBeVisible();
  await expect(burnedRow(page)).toHaveCount(0);
});

test("a figure outside 500 to 10,000 is refused with a message (AC-4)", async ({
  page,
}) => {
  const { kit } = await arrange({});
  await page.goto(`/?day=${PAST}`);

  await burnedRow(page).click();
  await sheet(page).getByLabel("Calories burned (kcal)").fill("100");
  await sheet(page).getByRole("button", { name: "Save" }).click();

  await expect(
    sheet(page).getByText("Enter between 500 and 10,000 kcal"),
  ).toBeVisible();
  const { data } = await kit.from("calories_burned").select("day");
  expect(data).toEqual([]);
});

test("Clear removes the figure (AC-4)", async ({ page }) => {
  const { kit } = await arrange({ burned: { day: PAST, calories: 2450 } });
  await page.goto(`/?day=${PAST}`);

  await burnedRow(page).click();
  const written = burnedWritten(page);
  await sheet(page).getByRole("button", { name: "Clear" }).click();
  await written;

  await expect(
    page.getByRole("button", { name: "Burned · Add" }),
  ).toBeVisible();
  const { data } = await kit.from("calories_burned").select("day");
  expect(data).toEqual([]);
});

test("a failed save puts the old figure back and offers to retry (AC-4)", async ({
  page,
}) => {
  await arrange({ burned: { day: PAST, calories: 2450 } });
  await page.route("**/rest/v1/calories_burned*", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: "{}",
        })
      : route.continue(),
  );
  await page.goto(`/?day=${PAST}`);

  await burnedRow(page).click();
  await sheet(page).getByLabel("Calories burned (kcal)").fill("3000");
  await sheet(page).getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Couldn't save that")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Burned 2,450 kcal/ }),
  ).toBeVisible();
});

test("switching it off hides everything but keeps the figures (AC-2)", async ({
  page,
}) => {
  const { kit } = await arrange({
    entry: { day: PAST, calories: 1840 },
    burned: { day: PAST, calories: 2450 },
  });
  await page.goto("/settings");
  await expect(trackSwitch(page)).toBeChecked();
  const written = page.waitForResponse(
    (response) =>
      response.request().method() !== "GET" &&
      response.url().includes("/rest/v1/user_settings"),
  );

  await trackSwitch(page).click();
  await written;

  await page.goto(`/?day=${PAST}`);
  await expect(page.getByRole("region", { name: "Daily total" })).toBeVisible();
  await expect(burnedRow(page)).toHaveCount(0);
  const { data } = await kit.from("calories_burned").select("calories");
  expect(data).toEqual([{ calories: 2450 }]);

  await page.goto("/settings");
  const back = page.waitForResponse(
    (response) =>
      response.request().method() !== "GET" &&
      response.url().includes("/rest/v1/user_settings"),
  );
  await trackSwitch(page).click();
  await back;
  await page.goto(`/?day=${PAST}`);
  await expect(
    page.getByRole("button", { name: "Burned 2,450 kcal · 610 kcal deficit" }),
  ).toBeVisible();
});
