import { expect, type Page, test } from "@playwright/test";
import { userClient } from "./support/db";
import { hold } from "./support/gestures";
import { clearDay, seedEntry, seedFood } from "./support/seed";

// Real vibration can't be observed, so a spy stands in for navigator.vibrate and records the
// patterns it is asked for. Each test uses a fixed Day long ago that only it uses.
declare global {
  interface Window {
    __vibrations: unknown[];
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__vibrations = [];
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      writable: true,
      value: (pattern: unknown) => {
        window.__vibrations.push(pattern);
        return true;
      },
    });
  });
});

const vibrations = (page: Page) => page.evaluate(() => window.__vibrations);
const picker = (page: Page) =>
  page.getByRole("dialog", { name: "Add to your day" });
const vibrationSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Vibration" });

async function logOne(page: Page, foodName: string) {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await picker(page)
    .getByRole("searchbox", { name: "Search foods" })
    .fill(foodName);
  await picker(page)
    .getByRole("button", { name: new RegExp(foodName) })
    .click();
  await picker(page)
    .getByRole("button", { name: "Add 1", exact: true })
    .click();
}

async function arrange(day: string) {
  const ada = await userClient("ada");
  await clearDay(ada, day);
  return seedFood(ada, { portion: "1 slice", calories: 100 });
}

test("adding an Entry gives one brief buzz", async ({ page }) => {
  const day = "2001-07-10";
  const food = await arrange(day);
  await page.goto(`/?day=${day}`);

  await logOne(page, food.name);

  await expect(page.getByText(`Added 1 × ${food.name}`)).toBeVisible();
  expect(await vibrations(page)).toEqual([10]);
});

test("a save that fails and rolls back gives the double pulse", async ({
  page,
}) => {
  const day = "2001-07-11";
  const food = await arrange(day);
  await page.route("**/rest/v1/entries*", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: "{}",
        })
      : route.continue(),
  );
  await page.goto(`/?day=${day}`);

  await logOne(page, food.name);

  await expect(page.getByText("Couldn't save that")).toBeVisible();
  // The tap when it was added, then the pulses when it was taken back.
  expect(await vibrations(page)).toEqual([10, [30, 60, 30]]);
});

test("nothing buzzes after Vibration is turned off in Settings, and it stays off", async ({
  page,
}) => {
  const day = "2001-07-12";
  const food = await arrange(day);
  await page.goto("/settings");
  await expect(vibrationSwitch(page)).toBeChecked();

  await vibrationSwitch(page).click();
  await expect(vibrationSwitch(page)).not.toBeChecked();
  await page.reload();
  await expect(vibrationSwitch(page)).not.toBeChecked();

  await page.goto(`/?day=${day}`);
  await logOne(page, food.name);
  await expect(page.getByText(`Added 1 × ${food.name}`)).toBeVisible();
  expect(await vibrations(page)).toEqual([]);
});

test("turning Vibration back on makes it buzz again", async ({ page }) => {
  const day = "2001-07-13";
  const food = await arrange(day);
  await page.goto("/settings");
  await vibrationSwitch(page).click();
  await vibrationSwitch(page).click();
  await expect(vibrationSwitch(page)).toBeChecked();

  await page.goto(`/?day=${day}`);
  await logOne(page, food.name);

  await expect(page.getByText(`Added 1 × ${food.name}`)).toBeVisible();
  expect(await vibrations(page)).toEqual([10]);
});

test("holding an Entry buzzes briefly, and deleting the selection buzzes firmer", async ({
  page,
}) => {
  const day = "2001-07-15";
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const names: string[] = [];
  for (const n of ["Apple", "Bread"]) {
    const food = await seedFood(ada, {
      name: `${n} ${Math.random().toString(36).slice(2, 6)}`,
      calories: 100,
    });
    names.push(food.name);
    await seedEntry(ada, { foodId: food.id, day, quantity: 1 });
  }
  await page.goto(`/?day=${day}`);

  await hold(page, page.getByRole("button", { name: new RegExp(names[0]) }));
  await expect(page.getByText("1 selected")).toBeVisible();
  expect(await vibrations(page)).toEqual([10]);

  // Picking more is just taps: no more buzzing.
  await page.getByRole("button", { name: new RegExp(names[1]) }).click();
  await expect(page.getByText("2 selected")).toBeVisible();
  expect(await vibrations(page)).toEqual([10]);

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Removed 2 entries")).toBeVisible();
  expect(await vibrations(page)).toEqual([10, 30]);
});

test("holding a Food buzzes briefly, and confirming its removal buzzes firmer", async ({
  page,
}) => {
  const ada = await userClient("ada");
  const token = `Zv${Math.random().toString(36).slice(2, 7)}`;
  await seedFood(ada, { name: `${token} Apple`, calories: 80 });
  await seedFood(ada, { name: `${token} Bread`, calories: 120 });
  await page.goto("/foods");
  await page.getByRole("searchbox", { name: "Search foods" }).fill(token);

  await hold(page, page.getByRole("button", { name: /Apple/ }));
  await expect(page.getByText("1 selected")).toBeVisible();
  expect(await vibrations(page)).toEqual([10]);

  // Asking is not deciding: cancelling gives no second buzz.
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(await vibrations(page)).toEqual([10]);

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete 1 food" }).click();
  await expect(page.getByText("Removed 1 food")).toBeVisible();
  expect(await vibrations(page)).toEqual([10, 30]);
});

test("a delete that fails is felt twice: firmly, then the double pulse", async ({
  page,
}) => {
  const day = "2001-07-16";
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const food = await seedFood(ada, { calories: 100 });
  await seedEntry(ada, { foodId: food.id, day, quantity: 1 });
  await page.route("**/rest/v1/entries*", (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: "{}",
        })
      : route.continue(),
  );
  await page.goto(`/?day=${day}`);

  await hold(page, page.getByRole("button", { name: new RegExp(food.name) }));
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByText("Couldn't save that")).toBeVisible();
  expect(await vibrations(page)).toEqual([10, 30, [30, 60, 30]]);
});

test("the Vibration row is easy to tap", async ({ page }) => {
  await page.goto("/settings");

  const row = await page.getByText("Vibration", { exact: true }).boundingBox();

  expect(row?.height).toBeGreaterThanOrEqual(44);
});

test.describe("on a phone that cannot vibrate", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: undefined,
      });
    });
  });

  test("Settings has no Vibration switch, and logging still works", async ({
    page,
  }) => {
    const day = "2001-07-14";
    const food = await arrange(day);
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Week starts on")).toBeVisible();
    await expect(vibrationSwitch(page)).toHaveCount(0);

    await page.goto(`/?day=${day}`);
    await logOne(page, food.name);

    await expect(page.getByText(`Added 1 × ${food.name}`)).toBeVisible();
  });
});
