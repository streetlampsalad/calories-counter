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

  await page.goto("/settings/tracking");
  await expect(trackSwitch(page)).not.toBeChecked();
});

test("turning the switch on shows the Burned row on Today (AC-1, AC-3)", async ({
  page,
}) => {
  await arrange({ tracking: false });
  await page.goto("/settings/tracking");
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
  await page.goto("/settings/tracking");
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

  await page.goto("/settings/tracking");
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

// The Summary (spec 017 AC-6) on a frozen Tuesday, 3 Nov 2026, 1 pm in Sydney, so every number is
// known in advance.
test.describe("on the Summary", () => {
  test.use({ timezoneId: "Australia/Sydney" });
  const NOW = new Date("2026-11-03T02:00:00Z");

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
  });

  const headline = (page: Page) =>
    page.getByRole("region", { name: "Summary totals" });

  // 1 Nov: ate 2,600, burned 2,400 (a 200 surplus)  | 2 Nov: ate 1,500, burned 2,300 (800 deficit)
  // 3 Nov: ate 1,000, burned 2,000 (1,000 deficit)  | 31 Oct: outside this month
  async function arrangeMonth(tracking = true) {
    const kit = await userClient("kit");
    await resetBurned(kit);
    if (tracking) {
      const { error } = await kit
        .from("user_settings")
        .upsert({ track_calories_burned: true });
      if (error) throw new Error(error.message);
    }
    const hundred = await seedFood(kit, { portion: "1 serve", calories: 100 });
    // A Quantity tops out at 20, so a bigger Day is a few Entries.
    for (const [day, quantity] of [
      ["2026-10-31", 12],
      ["2026-11-01", 26],
      ["2026-11-02", 15],
      ["2026-11-03", 10],
    ] as const) {
      for (let left = quantity; left > 0; left -= 20) {
        await seedEntry(kit, {
          foodId: hundred.id,
          day,
          quantity: Math.min(left, 20),
        });
      }
    }
    const { error } = await kit.from("calories_burned").upsert([
      { day: "2026-10-31", calories: 9000 },
      { day: "2026-11-01", calories: 2400 },
      { day: "2026-11-02", calories: 2300 },
      { day: "2026-11-03", calories: 2000 },
    ]);
    if (error) throw new Error(error.message);
    return kit;
  }

  test("shows the average Deficit and how many Days were in Deficit (AC-6)", async ({
    page,
  }) => {
    await arrangeMonth();

    await page.goto("/summary?period=this-month");

    await expect(headline(page)).toContainText("Average deficit 533 kcal");
    await expect(headline(page)).toContainText("In deficit on 2 of 3 days");
  });

  test("counts only Days with both figures, never a missing one as zero (AC-6)", async ({
    page,
  }) => {
    const kit = await arrangeMonth();
    // 2 Nov loses its figure, so only 1 Nov (a surplus) and 3 Nov (a deficit) count.
    const { error } = await kit
      .from("calories_burned")
      .delete()
      .eq("day", "2026-11-02");
    expect(error).toBeNull();

    await page.goto("/summary?period=this-month");

    await expect(headline(page)).toContainText("Average deficit 400 kcal");
    await expect(headline(page)).toContainText("In deficit on 1 of 2 days");
  });

  test("an average Surplus reads as a surplus (AC-6)", async ({ page }) => {
    const kit = await arrangeMonth();
    const { error } = await kit.from("calories_burned").upsert([
      { day: "2026-11-02", calories: 1400 },
      { day: "2026-11-03", calories: 700 },
    ]);
    expect(error).toBeNull();

    await page.goto("/summary?period=this-month");

    // 200, 100 and 300 kcal surpluses: a 200 kcal surplus on average.
    await expect(headline(page)).toContainText("Average surplus 200 kcal");
    await expect(headline(page)).toContainText("In deficit on 0 of 3 days");
  });

  test("points to Today when no logged Day has Calories Burned (AC-6)", async ({
    page,
  }) => {
    const kit = await arrangeMonth();
    const { error } = await kit
      .from("calories_burned")
      .delete()
      .not("user_id", "is", null);
    expect(error).toBeNull();

    await page.goto("/summary?period=this-month");

    await expect(headline(page)).toContainText(
      "Add calories burned on Today to see your deficit",
    );
  });

  test("shows nothing about it unless the User tracks Calories Burned (AC-2)", async ({
    page,
  }) => {
    await arrangeMonth(false);

    await page.goto("/summary?period=this-month");

    await expect(headline(page)).toContainText("5,100");
    await expect(headline(page)).not.toContainText(/deficit|surplus|burned/i);
  });

  test("the totals and the average per logged day are unchanged by it (AC-7)", async ({
    page,
  }) => {
    await arrangeMonth();

    await page.goto("/summary?period=this-month");

    await expect(headline(page)).toContainText("5,100");
    await expect(headline(page)).toContainText(
      "Average 1,700 kcal per logged day",
    );
    await expect(headline(page)).toContainText("3 of 3 days logged");
  });

  test("asks the database for the whole Period once (AC-7)", async ({
    page,
  }) => {
    await arrangeMonth();
    const calls: string[] = [];
    page.on("request", (request) => {
      const match = /\/rest\/v1\/rpc\/(period_days|daily_totals)/.exec(
        request.url(),
      );
      if (match) calls.push(match[1]);
    });

    await page.goto("/summary?period=this-month");
    await expect(headline(page)).toContainText("Average deficit");

    expect(calls).toEqual(["period_days"]);
  });
});
