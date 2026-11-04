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

test("the Today button returns from another Day, and back returns to that Day", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Today" })).toHaveCount(0);

  await page.getByRole("button", { name: "Next day" }).click();
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(page).toHaveURL(`/?day=${daysAhead(2)}`);
  await page.getByRole("button", { name: "Today" }).click();

  await expect(heading(page)).toHaveText("Today");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Today" })).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(`/?day=${daysAhead(2)}`);
});

test("the Today button also returns from a past Day", async ({ page }) => {
  await page.goto("/?day=2001-07-05");

  await page.getByRole("button", { name: "Today" }).click();

  await expect(heading(page)).toHaveText("Today");
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

// Spec 019: moving between Days never shifts what is on screen, because the way home to today is a
// pill beside Add rather than a button that appears in the header.
const total = (page: Page) =>
  page.locator('section[aria-labelledby="daily-total-heading"]');

async function layout(page: Page) {
  await expect(total(page)).toBeVisible();
  const box = async (locator: ReturnType<Page["locator"]>) => {
    const found = await locator.boundingBox();
    if (!found) throw new Error("not on screen");
    return found;
  };
  return {
    previous: await box(page.getByRole("button", { name: "Previous day" })),
    next: await box(page.getByRole("button", { name: "Next day" })),
    heading: await box(heading(page)),
    total: await box(total(page)),
  };
}

test("moving between today and any other Day never moves the arrows, the date or the total (spec 019 AC-1)", async ({
  page,
}) => {
  await page.goto("/");
  const onToday = await layout(page);

  for (const url of [
    `/?day=${daysAgo(1)}`,
    "/?day=2001-07-05",
    `/?day=${daysAhead(1)}`,
    `/?day=${daysAhead(14)}`,
    "/",
  ]) {
    await page.goto(url);
    const elsewhere = await layout(page);

    for (const part of ["previous", "next"] as const) {
      expect(elsewhere[part].x, `${part} arrow, ${url}`).toBeCloseTo(
        onToday[part].x,
        0,
      );
      expect(elsewhere[part].y, `${part} arrow, ${url}`).toBeCloseTo(
        onToday[part].y,
        0,
      );
    }
    expect(elsewhere.heading.y, `date, ${url}`).toBeCloseTo(
      onToday.heading.y,
      0,
    );
    expect(elsewhere.heading.height, `date, ${url}`).toBeCloseTo(
      onToday.heading.height,
      0,
    );
    expect(elsewhere.total.y, `total, ${url}`).toBeCloseTo(onToday.total.y, 0);
    expect(elsewhere.total.height, `total, ${url}`).toBeCloseTo(
      onToday.total.height,
      0,
    );
  }
});

test("stepping with the arrows, one Day at a time, leaves them under the thumb (spec 019 AC-1)", async ({
  page,
}) => {
  await page.goto("/");
  const before = await layout(page);

  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(heading(page)).toHaveText("Yesterday");
  const yesterday = await layout(page);
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(heading(page)).toHaveText("Today");
  const after = await layout(page);

  for (const state of [yesterday, after]) {
    expect(state.previous.y).toBeCloseTo(before.previous.y, 0);
    expect(state.total.y).toBeCloseTo(before.total.y, 0);
  }
});

test("the Today pill floats opposite Add, clear of the bottom navigation, only away from today (spec 019 AC-2)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(total(page)).toBeVisible();
  const pill = page.getByRole("button", { name: "Today" });
  await expect(pill).toBeHidden();

  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(pill).toBeVisible();

  const pillBox = await pill.boundingBox();
  const addBox = await page
    .getByRole("button", { name: "Add", exact: true })
    .boundingBox();
  const navBox = await page.locator("nav").last().boundingBox();
  if (!pillBox || !addBox || !navBox) throw new Error("not on screen");
  expect(pillBox.height).toBeGreaterThanOrEqual(44);
  expect(pillBox.x + pillBox.width).toBeLessThan(addBox.x);
  expect(pillBox.x).toBeLessThan(addBox.x);
  expect(pillBox.y + pillBox.height).toBeLessThanOrEqual(navBox.y);
  // Level with Add: their middles line up.
  expect(pillBox.y + pillBox.height / 2).toBeCloseTo(
    addBox.y + addBox.height / 2,
    0,
  );
});

test("the Today pill fades, unless the phone asks for reduced motion (spec 019 AC-2, AC-8)", async ({
  page,
}) => {
  const transition = (pill: ReturnType<Page["locator"]>) =>
    pill.evaluate((element) => getComputedStyle(element).transitionProperty);

  await page.goto("/?day=2001-07-05");
  const pill = page.getByRole("button", { name: "Today" });
  await expect(pill).toBeVisible();
  expect(await transition(pill)).toContain("opacity");

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await transition(pill)).toBe("none");
});

// Spec 019: the Daily Total counts to a new value instead of jumping. A frame-by-frame recorder
// notes every figure the big number shows, so a test can tell counting from jumping.
type Recorded = Window & { __seen: string[] };

async function recordTotal(page: Page) {
  await page.addInitScript(() => {
    const recorded = window as unknown as Recorded;
    recorded.__seen = [];
    const read = () =>
      document.querySelector(
        'section[aria-labelledby="daily-total-heading"] [aria-hidden="true"] > span',
      )?.textContent ?? null;
    const tick = () => {
      const figure = read();
      if (figure && recorded.__seen.at(-1) !== figure)
        recorded.__seen.push(figure);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const seen = async (page: Page) =>
  (await page.evaluate(() => (window as unknown as Recorded).__seen)).map(
    (figure) => Number(figure.replace(/,/g, "")),
  );

async function arrangeCount(day: string, calories: number, quantity: number) {
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const kept = await seedFood(ada, { portion: "1 slice", calories });
  await seedEntry(ada, { foodId: kept.id, day, quantity });
  const added = await seedFood(ada, { portion: "1 slice", calories: 600 });
  return added;
}

test("adding an Entry counts the total up to its new value (spec 019 AC-3)", async ({
  page,
}) => {
  const day = "2001-08-01";
  const added = await arrangeCount(day, 100, 10); // 1,000 kcal
  await recordTotal(page);
  await page.goto(`/?day=${day}`);
  await expect(total(page)).toContainText("1,000");

  await logOnCurrentDay(page, added.name, "Add 1"); // + 600

  await expect(total(page)).toContainText("1,600");
  await expect.poll(async () => (await seen(page)).at(-1)).toBe(1600);
  const figures = await seen(page);
  const between = figures.filter((figure) => figure > 1000 && figure < 1600);
  expect(between.length, `saw ${figures.join(", ")}`).toBeGreaterThan(0);
  // Counting up only: every figure is at least the one before it.
  expect(figures).toEqual([...figures].sort((a, b) => a - b));
});

test("removing an Entry counts the total back down (spec 019 AC-3)", async ({
  page,
}) => {
  const day = "2001-08-02";
  const added = await arrangeCount(day, 100, 10);
  const ada = await userClient("ada");
  await seedEntry(ada, { foodId: added.id, day, quantity: 1 }); // 1,600 kcal
  await recordTotal(page);
  await page.goto(`/?day=${day}`);
  await expect(total(page)).toContainText("1,600");

  await page
    .getByRole("list", { name: "Entries" })
    .getByRole("listitem")
    .filter({ hasText: added.name })
    .getByRole("button")
    .click();
  await page
    .getByRole("dialog", { name: "Edit entry" })
    .getByRole("button", { name: "Remove entry" })
    .click();

  await expect.poll(async () => (await seen(page)).at(-1)).toBe(1000);
  const figures = await seen(page);
  expect(figures.some((figure) => figure > 1000 && figure < 1600)).toBe(true);
  expect(figures).toEqual([...figures].sort((a, b) => b - a));
});

test("moving to another Day shows its total at once, with no counting (spec 019 AC-4)", async ({
  page,
}) => {
  const first = "2001-08-03";
  const second = "2001-08-04";
  const ada = await userClient("ada");
  await arrangeCount(first, 100, 10); // 1,000
  await clearDay(ada, second);
  const food = await seedFood(ada, { portion: "1 slice", calories: 100 });
  await seedEntry(ada, { foodId: food.id, day: second, quantity: 18 }); // 1,800
  await recordTotal(page);
  await page.goto(`/?day=${first}`);
  await expect(total(page)).toContainText("1,000");
  await page.evaluate(() => {
    (window as unknown as Recorded).__seen = [];
  });

  await page.getByRole("button", { name: "Next day" }).click();

  await expect(total(page)).toContainText("1,800");
  await page.waitForTimeout(600);
  const figures = await seen(page);
  expect(
    figures.filter((figure) => figure !== 1800 && figure !== 1000),
  ).toEqual([]);
  expect(figures.at(-1)).toBe(1800);
});

test("with reduced motion the total jumps rather than counts (spec 019 AC-8)", async ({
  page,
}) => {
  const day = "2001-08-05";
  const added = await arrangeCount(day, 100, 10);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recordTotal(page);
  await page.goto(`/?day=${day}`);
  await expect(total(page)).toContainText("1,000");

  await logOnCurrentDay(page, added.name, "Add 1");

  await expect.poll(async () => (await seen(page)).at(-1)).toBe(1600);
  await page.waitForTimeout(600);
  expect(await seen(page)).toEqual([1000, 1600]);
});

// Spec 019 AC-7: Entry rows animate in and out. A frame-by-frame recorder notes each row's height,
// so growing and collapsing can be told from jumping.
type RecordedRows = Window & { __rows: Record<string, number[]> };

async function recordRows(page: Page) {
  await page.addInitScript(() => {
    const recorded = window as unknown as RecordedRows;
    recorded.__rows = {};
    const tick = () => {
      for (const item of document.querySelectorAll(
        'ul[aria-label="Entries"] > li',
      )) {
        const name = item.querySelector("span.font-medium")?.textContent ?? "";
        const height = Math.round(item.getBoundingClientRect().height);
        recorded.__rows[name] ??= [];
        const series = recorded.__rows[name];
        if (series.at(-1) !== height) series.push(height);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const rowHeights = async (page: Page, name: string) =>
  (await page.evaluate(
    (key) => (window as unknown as RecordedRows).__rows[key] ?? [],
    name,
  )) as number[];

test("a newly logged Entry grows into the list while the rest stay put (spec 019 AC-7)", async ({
  page,
}) => {
  const day = "2001-09-01";
  const added = await arrangeCount(day, 100, 10);
  await recordRows(page);
  await page.goto(`/?day=${day}`);
  await expect(total(page)).toContainText("1,000");

  await logOnCurrentDay(page, added.name, "Add 1");

  await expect(entries(page).filter({ hasText: added.name })).toBeVisible();
  await page.waitForTimeout(500);
  const heights = await rowHeights(page, added.name);
  const settled = heights.at(-1) ?? 0;
  expect(settled).toBeGreaterThanOrEqual(56);
  expect(heights.length, `saw ${heights.join(", ")}`).toBeGreaterThan(2);
  expect(heights[0]).toBeLessThan(settled);
  expect(heights).toEqual([...heights].sort((a, b) => a - b));
});

test("a removed Entry collapses out before it goes (spec 019 AC-7)", async ({
  page,
}) => {
  const day = "2001-09-02";
  const added = await arrangeCount(day, 100, 10);
  const ada = await userClient("ada");
  await seedEntry(ada, { foodId: added.id, day, quantity: 1 });
  await recordRows(page);
  await page.goto(`/?day=${day}`);
  await expect(total(page)).toContainText("1,600");

  await entries(page)
    .filter({ hasText: added.name })
    .getByRole("button")
    .click();
  await page
    .getByRole("dialog", { name: "Edit entry" })
    .getByRole("button", { name: "Remove entry" })
    .click();

  // A leaving row is hidden from screen readers at once, so wait for the collapse itself to end.
  await expect(entries(page).filter({ hasText: added.name })).toHaveCount(0);
  await page.waitForTimeout(500);
  const heights = await rowHeights(page, added.name);
  const full = heights[0];
  expect(full).toBeGreaterThanOrEqual(56);
  expect(heights.length, `saw ${heights.join(", ")}`).toBeGreaterThan(2);
  expect(Math.min(...heights)).toBeLessThan(full);
  expect(heights).toEqual([...heights].sort((a, b) => b - a));
});

test("a Day's Entries are simply there when it opens, and when you move to it (spec 019 AC-7)", async ({
  page,
}) => {
  const first = "2001-09-03";
  const second = "2001-09-04";
  const ada = await userClient("ada");
  const added = await arrangeCount(first, 100, 10);
  await clearDay(ada, second);
  await seedEntry(ada, { foodId: added.id, day: second, quantity: 2 });
  await recordRows(page);

  await page.goto(`/?day=${first}`);
  await expect(total(page)).toContainText("1,000");
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(total(page)).toContainText("1,200");
  await page.waitForTimeout(500);

  const arrived = await rowHeights(page, added.name);
  // One figure only: the row was never anything but its full height.
  expect(new Set(arrived).size, `saw ${arrived.join(", ")}`).toBe(1);
  expect(arrived[0]).toBeGreaterThanOrEqual(56);
});

test("with reduced motion Entries appear and vanish without animating (spec 019 AC-8)", async ({
  page,
}) => {
  const day = "2001-09-05";
  const added = await arrangeCount(day, 100, 10);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recordRows(page);
  await page.goto(`/?day=${day}`);
  await expect(total(page)).toContainText("1,000");

  await logOnCurrentDay(page, added.name, "Add 1");
  await expect(entries(page).filter({ hasText: added.name })).toBeVisible();
  await page.waitForTimeout(500);

  const heights = await rowHeights(page, added.name);
  expect(new Set(heights).size, `saw ${heights.join(", ")}`).toBe(1);
});
