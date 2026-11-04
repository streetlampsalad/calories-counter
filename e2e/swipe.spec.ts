import { expect, type Page, test } from "@playwright/test";
import { userClient } from "./support/db";
import { hold } from "./support/gestures";
import { clearDay, seedEntry, seedFood } from "./support/seed";

const heading = (page: Page) => page.getByRole("heading", { level: 1 });

// A date on this machine's calendar, which is the one the browser uses.
const daysFromToday = (count: number) => {
  const date = new Date();
  date.setDate(date.getDate() + count);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// One finger across the Day view, `ms` long in all, on a line `dy` apart from where it started.
async function swipe(
  page: Page,
  from: number,
  to: number,
  { y = 420, dy = 0, ms = 0 } = {},
) {
  const steps = 8;
  await page.mouse.move(from, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from + ((to - from) * i) / steps,
      y + (dy * i) / steps,
    );
    if (ms) await page.waitForTimeout(ms / steps);
  }
  await page.mouse.up();
}
// A whole swipe inside one task of the page, so how fast it was does not depend on how busy the
// machine running the test is.
async function flick(page: Page, from: number, to: number, y = 420) {
  await page.evaluate(
    ({ from, to, y }) => {
      const area = document.querySelector("main");
      if (!area) throw new Error("No Day view");
      const fire = (type: string, x: number) =>
        area.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 7,
            pointerType: "touch",
            isPrimary: true,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
          }),
        );
      fire("pointerdown", from);
      fire("pointermove", from + (to - from) / 2);
      fire("pointermove", to);
      fire("pointerup", to);
    },
    { from, to, y },
  );
}
const width = (page: Page) => page.viewportSize()?.width ?? 412;
const swipeLeft = (page: Page) => swipe(page, width(page) - 80, 80);
const swipeRight = (page: Page) => swipe(page, 80, width(page) - 80);

test("swiping left goes to the next Day and swiping right comes back", async ({
  page,
}) => {
  await page.goto("/");

  await swipeLeft(page);
  await expect(heading(page)).toHaveText("Tomorrow");
  await expect(page).toHaveURL(`/?day=${daysFromToday(1)}`);

  await swipeRight(page);
  await expect(heading(page)).toHaveText("Today");
  await expect(page).toHaveURL("/");

  await swipeRight(page);
  await expect(heading(page)).toHaveText("Yesterday");
  await expect(page).toHaveURL(`/?day=${daysFromToday(-1)}`);
});

test("each swiped Day is a step for the back button, one at a time", async ({
  page,
}) => {
  await page.goto("/");
  await swipeLeft(page);
  await expect(page).toHaveURL(`/?day=${daysFromToday(1)}`);
  await swipeLeft(page);
  await expect(page).toHaveURL(`/?day=${daysFromToday(2)}`);

  await page.goBack();
  await expect(page).toHaveURL(`/?day=${daysFromToday(1)}`);
  await expect(heading(page)).toHaveText("Tomorrow");

  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(heading(page)).toHaveText("Today");
});

test("a short, slow swipe snaps back, but a quick flick counts", async ({
  page,
}) => {
  await page.goto("/");

  await swipe(page, 300, 260, { ms: 500 });
  await expect(heading(page)).toHaveText("Today");
  await expect(page).toHaveURL("/");

  // Under 25% of the width, so it is the speed that counts.
  await flick(page, 300, 220);
  await expect(heading(page)).toHaveText("Tomorrow");
});

test("a mostly vertical gesture does not change the Day", async ({ page }) => {
  await page.goto("/");

  await swipe(page, 220, 160, { dy: -300 });

  await expect(heading(page)).toHaveText("Today");
  await expect(page).toHaveURL("/");
});

test("a swipe from either screen edge is left to Android's back gesture", async ({
  page,
}) => {
  await page.goto("/");

  await swipe(page, 6, width(page) - 60);
  await expect(heading(page)).toHaveText("Today");

  await page.goto("/?day=" + daysFromToday(-3));
  await swipe(page, width(page) - 6, 60);
  await expect(page).toHaveURL(`/?day=${daysFromToday(-3)}`);
});

test("at the last Day that can be planned a swipe left snaps back, and right still goes", async ({
  page,
}) => {
  const last = daysFromToday(14);
  await page.goto(`/?day=${last}`);
  await expect(page.getByRole("button", { name: "Next day" })).toBeDisabled();

  await swipeLeft(page);
  await expect(page).toHaveURL(`/?day=${last}`);

  await swipeRight(page);
  await expect(page).toHaveURL(`/?day=${daysFromToday(13)}`);
});

test("it slides the new Day in, unless the phone asks for reduced motion", async ({
  page,
}) => {
  await page.goto("/");
  await swipeLeft(page);
  await expect(heading(page)).toHaveText("Tomorrow");
  await expect(page.locator("[data-slide='next']")).toHaveCount(1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await swipeRight(page);
  await expect(heading(page)).toHaveText("Today");
  await expect(page.locator("[data-slide]")).toHaveCount(0);
});

test("arrows change the Day without the slide", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Next day" }).click();

  await expect(heading(page)).toHaveText("Tomorrow");
  await expect(page.locator("[data-slide]")).toHaveCount(0);
});

test("a swipe across the picker does not change the Day behind it", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Add to your day" }),
  ).toBeVisible();

  await swipe(page, width(page) - 80, 80, { y: 600 });

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(heading(page)).toHaveText("Today");
  await expect(page).toHaveURL("/");
});

// An Entry on a Day of its own, so tests running side by side never clear each other's.
async function arrangeEntry(day: string) {
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const food = await seedFood(ada, { calories: 100 });
  await seedEntry(ada, { foodId: food.id, day, quantity: 1 });
  return food.name;
}

test.describe("with Entries on the Day", () => {
  test("swiping starting on an Entry changes the Day and does not open the Entry", async ({
    page,
  }) => {
    const day = "2001-08-02";
    const foodName = await arrangeEntry(day);
    await page.goto(`/?day=${day}`);
    const row = await page
      .getByRole("button", { name: new RegExp(foodName) })
      .boundingBox();
    if (!row) throw new Error("No Entry on screen");

    await swipe(page, width(page) - 80, 80, { y: row.y + row.height / 2 });

    await expect(page).toHaveURL("/?day=2001-08-03");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a swipe does nothing while items are being picked", async ({
    page,
  }) => {
    const day = "2001-08-04";
    const foodName = await arrangeEntry(day);
    await page.goto(`/?day=${day}`);
    await hold(page, page.getByRole("button", { name: new RegExp(foodName) }));
    await expect(page.getByText("1 selected")).toBeVisible();

    await swipeLeft(page);

    await expect(page).toHaveURL(`/?day=${day}`);
    await expect(page.getByText("1 selected")).toBeVisible();
  });
});
