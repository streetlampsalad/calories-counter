import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";
import { clearDay, resetUser, seedEntry, seedFood } from "./support/seed";

// Each test logs to a fixed Day long ago that only it uses, emptied first so re-runs start clean.
const total = (page: Page) => page.getByRole("region", { name: "Daily total" });
const entries = (page: Page) =>
  page.getByRole("list", { name: "Entries" }).getByRole("listitem");
const picker = (page: Page) =>
  page.getByRole("dialog", { name: "Add to your day" });

// Resolves when the server has answered a write to entries: the UI updates before that.
const savedEntry = (page: Page, method: "POST" | "DELETE") =>
  page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      response.url().includes("/rest/v1/entries"),
  );

async function openPickerFor(page: Page, foodName: string) {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(picker(page)).toBeVisible();
  await picker(page)
    .getByRole("searchbox", { name: "Search foods" })
    .fill(foodName);
  await picker(page)
    .getByRole("button", { name: new RegExp(foodName) })
    .click();
}

async function arrange(day: string, calories: number, portion = "1 slice") {
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const food = await seedFood(ada, { portion, calories });
  return { ada, food };
}

test("two taps log a Food: it appears with the total, and is still there after a reload", async ({
  page,
}) => {
  const day = "2001-04-01";
  const { food } = await arrange(day, 100);
  await page.goto(`/?day=${day}`);
  await expect(page.getByText("Nothing logged yet")).toBeVisible();

  await openPickerFor(page, food.name);
  const saved = savedEntry(page, "POST");
  await picker(page).getByRole("button", { name: "Add 1½" }).click();

  await expect(entries(page)).toHaveCount(1);
  await expect(entries(page).first()).toContainText(food.name);
  await expect(entries(page).first()).toContainText("1½ × 1 slice · 150 kcal");
  await expect(total(page)).toContainText("150");
  await expect(page.getByText(`Added 1½ × ${food.name}`)).toBeVisible();

  await saved; // the Entry is shown optimistically: make sure it landed before reloading
  await page.reload();
  await expect(entries(page)).toHaveCount(1);
  await expect(total(page)).toContainText("150");
});

test("Undo takes the Entry back off, for good", async ({ page }) => {
  const day = "2001-04-02";
  const { food } = await arrange(day, 100);
  await page.goto(`/?day=${day}`);

  await openPickerFor(page, food.name);
  await picker(page)
    .getByRole("button", { name: "Add 1", exact: true })
    .click();
  await expect(entries(page)).toHaveCount(1);

  const removed = savedEntry(page, "DELETE");
  await page.getByRole("button", { name: "Undo" }).click();

  await expect(entries(page)).toHaveCount(0);
  await expect(total(page)).toContainText("0");
  await removed;
  await page.reload();
  await expect(page.getByText("Nothing logged yet")).toBeVisible();
});

test("the stepper logs any amount in half-portion steps", async ({ page }) => {
  const day = "2001-04-03";
  const { food } = await arrange(day, 100);
  await page.goto(`/?day=${day}`);

  await openPickerFor(page, food.name);
  const more = picker(page).getByRole("button", { name: "More" });
  await more.click();
  await more.click();
  await more.click();
  await expect(picker(page).getByRole("status")).toHaveText("2½");
  await picker(page).getByRole("button", { name: "Add 2½ portions" }).click();

  await expect(entries(page).first()).toContainText("2½ × 1 slice · 250 kcal");
  await expect(total(page)).toContainText("250");
});

test("the Entry shows up before the server has answered", async ({ page }) => {
  const day = "2001-04-04";
  const { food } = await arrange(day, 100);
  await page.route("**/rest/v1/entries*", async (route) => {
    if (route.request().method() === "POST")
      await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });
  await page.goto(`/?day=${day}`);

  await openPickerFor(page, food.name);
  await picker(page)
    .getByRole("button", { name: "Add 2", exact: true })
    .click();

  // Far sooner than the 3 second server delay.
  await expect(entries(page)).toHaveCount(1, { timeout: 1500 });
  await expect(total(page)).toContainText("200", { timeout: 1500 });
});

test("a failed save takes the Entry back off and offers to retry", async ({
  page,
}) => {
  const day = "2001-04-05";
  const { food } = await arrange(day, 100);
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

  await openPickerFor(page, food.name);
  await picker(page)
    .getByRole("button", { name: "Add 1", exact: true })
    .click();

  await expect(page.getByText("Couldn't save that")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(entries(page)).toHaveCount(0);
  await expect(total(page)).toContainText("0");
});

test("the same Food logged twice in a Day is two Entries", async ({ page }) => {
  const day = "2001-04-06";
  const { food } = await arrange(day, 100);
  await page.goto(`/?day=${day}`);

  for (const label of ["Add 1", "Add 2"]) {
    await openPickerFor(page, food.name);
    await picker(page)
      .getByRole("button", { name: label, exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  await expect(entries(page)).toHaveCount(2);
  await expect(total(page)).toContainText("300");
});

test("the picker searches by typing, ignoring case and accents", async ({
  page,
}) => {
  const day = "2001-04-07";
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const tag = Math.random().toString(36).slice(2, 8);
  const cafe = await seedFood(ada, {
    name: `Café mocha ${tag}`,
    portion: "250 ml",
    calories: 150,
  });
  const toast = await seedFood(ada, {
    name: `Rye toast ${tag}`,
    portion: "1 slice",
    calories: 90,
  });
  await page.goto(`/?day=${day}`);
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await picker(page)
    .getByRole("searchbox", { name: "Search foods" })
    .fill(`CAFE ${tag}`);

  await expect(
    picker(page).getByRole("button", { name: new RegExp(cafe.name) }),
  ).toBeVisible();
  await expect(
    picker(page).getByRole("button", { name: new RegExp(toast.name) }),
  ).toHaveCount(0);
});

test("an Archived Food is not offered", async ({ page }) => {
  const day = "2001-04-08";
  const { ada, food } = await arrange(day, 100);
  await ada
    .from("foods")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", food.id);
  await page.goto(`/?day=${day}`);
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await picker(page)
    .getByRole("searchbox", { name: "Search foods" })
    .fill(food.name);

  await expect(picker(page).getByText(/No foods match/)).toBeVisible();
});

test.describe("a User with no Foods", () => {
  test.use({ storageState: authFile("cleo") });

  test("is pointed to adding one", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(picker(page).getByText("You have no foods yet")).toBeVisible();
    await picker(page)
      .getByRole("link", { name: "Add your first food" })
      .click();

    await expect(page).toHaveURL("/foods");
  });
});

test("the picker fits a phone and its Quantity buttons are easy to hit", async ({
  page,
}) => {
  const day = "2001-04-09";
  const { food } = await arrange(day, 100);
  await page.goto(`/?day=${day}`);

  await openPickerFor(page, food.name);

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
  for (const label of ["Add ½", "Add 1", "Add 1½", "Add 2", "Add 3"]) {
    const box = await picker(page)
      .getByRole("button", { name: label, exact: true })
      .boundingBox();
    expect(box?.height, label).toBeGreaterThanOrEqual(44);
    expect(box?.width, label).toBeGreaterThanOrEqual(44);
  }
});

test.describe("the picker learns what you eat", () => {
  // These depend on a User's whole history, so they use dan alone, one at a time.
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: authFile("dan") });

  const pad = (n: number) => String(n).padStart(2, "0");
  // A recent Day, on this machine's calendar (the same one the browser uses).
  const daysAgo = (count: number) => {
    const date = new Date();
    date.setDate(date.getDate() - count);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const startFresh = async () => {
    const dan = await userClient("dan");
    await resetUser(dan);
    return dan;
  };

  test("lists the most-logged Foods first and shows the latest as Recent", async ({
    page,
  }) => {
    const dan = await startFresh();
    // Alphabetical order (Aaa, Bbb, Ccc) is the opposite of how often they are logged.
    const aaa = await seedFood(dan, {
      name: "Aaa",
      portion: "1 slice",
      calories: 100,
    });
    const bbb = await seedFood(dan, {
      name: "Bbb",
      portion: "1 slice",
      calories: 100,
    });
    const ccc = await seedFood(dan, {
      name: "Ccc",
      portion: "1 slice",
      calories: 100,
    });
    const day = daysAgo(3);
    for (const food of [aaa, ccc, ccc, bbb, bbb, bbb]) {
      await seedEntry(dan, { foodId: food.id, day, quantity: 1 });
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(picker(page)).toBeVisible();

    // Recent: newest first (Bbb was logged last, Aaa first).
    const recent = picker(page)
      .getByRole("group", { name: "Recent" })
      .getByRole("button");
    await expect(recent).toHaveText(["Bbb", "Ccc", "Aaa"]);

    // The list: most-logged first (Bbb 3, Ccc 2, Aaa 1), where plain alphabetical would be reversed.
    const list = picker(page)
      .getByRole("list", { name: "Your foods" })
      .getByRole("listitem");
    await expect(list.nth(0)).toContainText("Bbb");
    await expect(list.nth(1)).toContainText("Ccc");
    await expect(list.nth(2)).toContainText("Aaa");

    // Searching keeps that order and hides Recent.
    await picker(page)
      .getByRole("searchbox", { name: "Search foods" })
      .fill("b");
    await expect(
      picker(page).getByRole("group", { name: "Recent" }),
    ).toHaveCount(0);
  });

  test("logs a Recent Food in two taps", async ({ page }) => {
    const dan = await startFresh();
    const food = await seedFood(dan, {
      name: "Porridge",
      portion: "1 cup",
      calories: 80,
    });
    await seedEntry(dan, { foodId: food.id, day: daysAgo(2), quantity: 1 });

    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await picker(page)
      .getByRole("group", { name: "Recent" })
      .getByRole("button", { name: "Porridge" })
      .click();
    const saved = savedEntry(page, "POST");
    await picker(page)
      .getByRole("button", { name: "Add 2", exact: true })
      .click();

    await expect(entries(page).filter({ hasText: "Porridge" })).toContainText(
      "2 × 1 cup · 160 kcal",
    );
    await saved;
  });

  test("a Food that is only planned does not count as Recent or reorder the list", async ({
    page,
  }) => {
    const dan = await startFresh();
    const eaten = await seedFood(dan, {
      name: "Eaten",
      portion: "1 cup",
      calories: 80,
    });
    const planned = await seedFood(dan, {
      name: "Planned",
      portion: "1 cup",
      calories: 90,
    });
    await seedEntry(dan, { foodId: eaten.id, day: daysAgo(1), quantity: 1 });
    for (const ahead of [1, 2, 3]) {
      await seedEntry(dan, {
        foodId: planned.id,
        day: daysAgo(-ahead),
        quantity: 1,
      });
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(
      picker(page).getByRole("button", { name: /Planned/ }),
    ).toBeVisible();

    await expect(
      picker(page).getByRole("group", { name: "Recent" }).getByRole("button"),
    ).toHaveText(["Eaten"]);
    // Planned three times but never eaten: it must not outrank the Food that was eaten.
    const list = picker(page)
      .getByRole("list", { name: "Your foods" })
      .getByRole("listitem");
    await expect(list.nth(0)).toContainText("Eaten");
    await expect(list.nth(1)).toContainText("Planned");
  });

  test("Foods logged long ago do not count as Recent", async ({ page }) => {
    const dan = await startFresh();
    const food = await seedFood(dan, {
      name: "Ancient",
      portion: "1 cup",
      calories: 80,
    });
    await seedEntry(dan, { foodId: food.id, day: "2001-06-01", quantity: 1 });

    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(
      picker(page).getByRole("button", { name: /Ancient/ }),
    ).toBeVisible();

    await expect(
      picker(page).getByRole("group", { name: "Recent" }),
    ).toHaveCount(0);
  });

  test("with 35 Foods the picker keeps its header, search and Recent on screen, and the list scrolls", async ({
    page,
  }) => {
    const dan = await startFresh();
    const foods = [];
    for (let n = 1; n <= 35; n++) {
      foods.push(
        await seedFood(dan, {
          name: `Food ${pad(n)}`,
          portion: "1 serve",
          calories: 100 + n,
        }),
      );
    }
    for (const food of foods.slice(0, 3)) {
      await seedEntry(dan, { foodId: food.id, day: daysAgo(2), quantity: 1 });
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(picker(page)).toBeVisible();

    // The sheet is a fixed height, so a long list scrolls inside it instead of pushing its top off the screen.
    await expect(
      picker(page).getByRole("heading", { name: "Add to your day" }),
    ).toBeInViewport();
    await expect(
      picker(page).getByRole("searchbox", { name: "Search foods" }),
    ).toBeInViewport();
    await expect(
      picker(page).getByRole("group", { name: "Recent" }),
    ).toBeInViewport();

    // Without searching, the last Food is reachable by scrolling, and can be logged.
    const last = picker(page).getByRole("button", { name: /Food 35/ });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await last.click();
    const saved = savedEntry(page, "POST");
    await picker(page)
      .getByRole("button", { name: "Add 1", exact: true })
      .click();

    await expect(entries(page).filter({ hasText: "Food 35" })).toContainText(
      "1 × 1 serve · 135 kcal",
    );
    await saved;
  });
});

test("confirmation toasts sit above the Add button and never cover the header controls", async ({
  page,
}) => {
  const day = "2001-04-10";
  const { food } = await arrange(day, 100);
  await page.goto(`/?day=${day}`);

  await openPickerFor(page, food.name);
  await picker(page)
    .getByRole("button", { name: "Add 1", exact: true })
    .click();

  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible();
  // A toast slides in, so wait for it to settle before measuring.
  await expect(async () => {
    const [toastBox, addBox, previousBox] = await Promise.all([
      toast.boundingBox(),
      page.getByRole("button", { name: "Add", exact: true }).boundingBox(),
      page.getByRole("button", { name: "Previous day" }).boundingBox(),
    ]);
    if (!toastBox || !addBox || !previousBox)
      throw new Error("element not measured yet");
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(addBox.y);
    expect(toastBox.y).toBeGreaterThan(previousBox.y + previousBox.height);
  }).toPass();
});
