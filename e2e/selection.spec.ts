import { expect, type Page, test } from "@playwright/test";
import { userClient } from "./support/db";
import { hold } from "./support/gestures";
import { clearDay, seedEntry, seedFood } from "./support/seed";

// Each test uses a fixed Day long ago that only it uses, emptied first so re-runs start clean.
const entries = (page: Page) =>
  page.getByRole("list", { name: "Entries" }).getByRole("listitem");
const row = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(name) });
const bar = (page: Page) => page.getByRole("toolbar", { name: "Selection" });
const total = (page: Page) => page.getByRole("region", { name: "Daily total" });

const savedEntry = (page: Page, method: "POST" | "DELETE") =>
  page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      response.url().includes("/rest/v1/entries"),
  );

// Three Entries of 100 kcal each, on `day`.
async function arrange(day: string) {
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const names = ["Apple", "Bread", "Cheese"].map(
    (n) => `${n} ${Math.random().toString(36).slice(2, 6)}`,
  );
  for (const name of names) {
    const food = await seedFood(ada, {
      name,
      portion: "1 piece",
      calories: 100,
    });
    await seedEntry(ada, { foodId: food.id, day, quantity: 1 });
  }
  return { ada, names };
}

test.describe("selecting Entries", () => {
  test("holding an Entry starts selection with that Entry, and does not open it", async ({
    page,
  }) => {
    const day = "2001-06-01";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);

    await hold(page, row(page, names[0]));

    await expect(bar(page)).toContainText("1 selected");
    await expect(row(page, names[0])).toHaveAttribute("aria-pressed", "true");
    await expect(row(page, names[1])).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Add", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  });

  test("taps pick and unpick Entries, and unpicking the last one ends selection", async ({
    page,
  }) => {
    const day = "2001-06-02";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);
    await hold(page, row(page, names[0]));

    await row(page, names[1]).click();
    await expect(bar(page)).toContainText("2 selected");
    await row(page, names[0]).click();
    await expect(bar(page)).toContainText("1 selected");
    await row(page, names[1]).click();

    await expect(bar(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add", exact: true }),
    ).toBeVisible();
  });

  test("a plain tap still opens the Entry when nothing is selected", async ({
    page,
  }) => {
    const day = "2001-06-03";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);

    await row(page, names[0]).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
  });

  test("Select all picks every Entry, and ✕ ends selection", async ({
    page,
  }) => {
    const day = "2001-06-04";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);
    await hold(page, row(page, names[1]));

    await bar(page).getByRole("button", { name: "Select all" }).click();
    await expect(bar(page)).toContainText("3 selected");
    await bar(page).getByRole("button", { name: "Cancel selection" }).click();

    await expect(bar(page)).toHaveCount(0);
    await expect(entries(page)).toHaveCount(3);
    await expect(row(page, names[1])).not.toHaveAttribute("aria-pressed");
  });

  test("the phone's back button ends selection without leaving the Day", async ({
    page,
  }) => {
    const day = "2001-06-05";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);
    await hold(page, row(page, names[0]));
    await expect(bar(page)).toBeVisible();

    await page.goBack();

    await expect(bar(page)).toHaveCount(0);
    await expect(page).toHaveURL(`/?day=${day}`);
    await expect(entries(page)).toHaveCount(3);
  });

  test("ending selection with ✕ leaves no extra step for back to take", async ({
    page,
  }) => {
    const day = "2001-06-06";
    const { names } = await arrange(day);
    await page.goto("/");
    await page.goto(`/?day=${day}`);
    await hold(page, row(page, names[0]));
    await bar(page).getByRole("button", { name: "Cancel selection" }).click();
    await expect(bar(page)).toHaveCount(0);

    await page.goBack();

    await expect(page).toHaveURL("/");
  });
});

test.describe("deleting selected Entries", () => {
  test("they go at once with no confirmation, and Undo puts them all back", async ({
    page,
  }) => {
    const day = "2001-06-07";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);
    await expect(total(page)).toContainText("300");
    await hold(page, row(page, names[0]));
    await row(page, names[1]).click();

    const deleted = savedEntry(page, "DELETE");
    await bar(page).getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Removed 2 entries")).toBeVisible();
    await expect(entries(page)).toHaveCount(1);
    await expect(total(page)).toContainText("100");
    await expect(bar(page)).toHaveCount(0);
    await deleted;

    const restored = savedEntry(page, "POST");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(entries(page)).toHaveCount(3);
    await expect(total(page)).toContainText("300");
    await restored;
    await page.reload();
    await expect(entries(page)).toHaveCount(3);
  });

  test("a deleted pair stays deleted after a reload", async ({ page }) => {
    const day = "2001-06-08";
    const { names } = await arrange(day);
    await page.goto(`/?day=${day}`);
    await hold(page, row(page, names[2]));
    await bar(page).getByRole("button", { name: "Select all" }).click();

    const deleted = savedEntry(page, "DELETE");
    await bar(page).getByRole("button", { name: "Delete" }).click();
    await deleted;

    await expect(page.getByText("Removed 3 entries")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Nothing logged yet")).toBeVisible();
  });

  test("a failed delete brings every Entry back and offers to retry", async ({
    page,
  }) => {
    const day = "2001-06-09";
    const { names } = await arrange(day);
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
    await hold(page, row(page, names[0]));
    await row(page, names[1]).click();

    await bar(page).getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Couldn't save that")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(entries(page)).toHaveCount(3);
    await expect(total(page)).toContainText("300");
  });
});

// ---- Foods (spec 014). Each test makes four Foods with a token of its own in their names, so it
// can search for just them while other tests share the same User's Food List.
const foodList = (page: Page) => page.getByRole("list", { name: "Your foods" });
const foodRow = (page: Page, name: string) =>
  foodList(page).getByRole("button", { name: new RegExp(name) });
const searchBox = (page: Page) =>
  page.getByRole("searchbox", { name: "Search foods" });
const confirmSheet = (page: Page) => page.getByRole("dialog");

async function arrangeFoods(day: string) {
  const ada = await userClient("ada");
  await clearDay(ada, day);
  const token = `Zq${Math.random().toString(36).slice(2, 7)}`;
  const make = async (word: string, calories: number) => {
    const food = await seedFood(ada, {
      name: `${token} ${word}`,
      portion: "1 serve",
      calories,
    });
    return { ...food, word };
  };
  const logged = [await make("Apple", 80), await make("Bread", 120)];
  const unused = [await make("Cheese", 200), await make("Dates", 60)];
  for (const food of logged) {
    await seedEntry(ada, { foodId: food.id, day, quantity: 1 });
  }
  const all = [...logged, ...unused];
  const state = async () => {
    const { data } = await ada
      .from("foods")
      .select("id, archived_at")
      .in(
        "id",
        all.map((food) => food.id),
      );
    return new Map((data ?? []).map((row) => [row.id, row.archived_at]));
  };
  return { ada, token, logged, unused, all, state };
}

test.describe("selecting Foods", () => {
  test("holding a Food starts selection instead of opening it, and taps then pick", async ({
    page,
  }) => {
    const { token, logged } = await arrangeFoods("2001-06-20");
    await page.goto("/foods");
    await searchBox(page).fill(token);

    await hold(page, foodRow(page, logged[0].word));

    await expect(bar(page)).toContainText("1 selected");
    await expect(foodRow(page, logged[0].word)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add food" })).toHaveCount(0);
    await foodRow(page, logged[1].word).click();
    await expect(bar(page)).toContainText("2 selected");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a plain tap still opens the Food to edit", async ({ page }) => {
    const { token, logged } = await arrangeFoods("2001-06-21");
    await page.goto("/foods");
    await searchBox(page).fill(token);

    await foodRow(page, logged[0].word).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
  });

  test("search keeps working, Select all picks what is shown, and earlier picks survive a search", async ({
    page,
  }) => {
    const { token, logged, unused } = await arrangeFoods("2001-06-22");
    await page.goto("/foods");
    await searchBox(page).fill(token);
    await hold(page, foodRow(page, logged[0].word));

    await searchBox(page).fill(`${token} ${unused[0].word}`);
    await expect(foodList(page).getByRole("listitem")).toHaveCount(1);
    await bar(page).getByRole("button", { name: "Select all" }).click();

    // The Food that is no longer shown is still picked, and still counted.
    await expect(bar(page)).toContainText("2 selected");
    await searchBox(page).fill(token);
    await expect(foodRow(page, logged[0].word)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(foodRow(page, unused[0].word)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(foodRow(page, logged[1].word)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("the phone's back button ends selection without leaving Foods", async ({
    page,
  }) => {
    const { token, logged } = await arrangeFoods("2001-06-23");
    await page.goto("/foods");
    await searchBox(page).fill(token);
    await hold(page, foodRow(page, logged[0].word));

    await page.goBack();

    await expect(bar(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/foods$/);
    await expect(page.getByRole("heading", { name: "Foods" })).toBeVisible();
  });
});

test.describe("removing selected Foods", () => {
  test("it asks, saying who is archived and who is deleted, and Undo reverses both", async ({
    page,
  }) => {
    const { token, all, logged, unused, state } =
      await arrangeFoods("2001-06-24");
    await page.goto("/foods");
    await searchBox(page).fill(token);
    await hold(page, foodRow(page, logged[0].word));
    await bar(page).getByRole("button", { name: "Select all" }).click();
    await expect(bar(page)).toContainText("4 selected");

    await bar(page).getByRole("button", { name: "Delete" }).click();

    await expect(
      confirmSheet(page).getByRole("heading", { name: "Remove 4 foods?" }),
    ).toBeVisible();
    await expect(confirmSheet(page)).toContainText(
      "2 you've logged will be archived, 2 will be deleted.",
    );
    await confirmSheet(page)
      .getByRole("button", { name: "Remove 4 foods" })
      .click();

    await expect(page.getByText("Removed 4 foods")).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
    await expect(foodList(page)).toHaveCount(0);
    await expect.poll(async () => (await state()).size).toBe(2);
    const afterRemoval = await state();
    expect(afterRemoval.get(logged[0].id)).not.toBeNull();
    expect(afterRemoval.get(logged[1].id)).not.toBeNull();
    expect(afterRemoval.has(unused[0].id)).toBe(false);

    await page.getByRole("button", { name: "Undo" }).click();

    await expect(foodList(page).getByRole("listitem")).toHaveCount(4);
    await expect.poll(async () => (await state()).size).toBe(4);
    const afterUndo = await state();
    for (const food of all) expect(afterUndo.get(food.id)).toBeNull();
    // The deleted Foods are back with their own values, not look-alikes.
    await expect(foodRow(page, unused[0].word)).toContainText("200 kcal");
  });

  test("cancelling changes nothing and keeps the selection", async ({
    page,
  }) => {
    const { token, logged, state, all } = await arrangeFoods("2001-06-25");
    await page.goto("/foods");
    await searchBox(page).fill(token);
    await hold(page, foodRow(page, logged[0].word));
    await foodRow(page, logged[1].word).click();
    await bar(page).getByRole("button", { name: "Delete" }).click();
    await expect(confirmSheet(page)).toContainText("Archive 2 foods?");

    await confirmSheet(page).getByRole("button", { name: "Cancel" }).click();

    await expect(confirmSheet(page)).toHaveCount(0);
    await expect(bar(page)).toContainText("2 selected");
    expect((await state()).size).toBe(all.length);
    for (const archivedAt of (await state()).values()) {
      expect(archivedAt).toBeNull();
    }
  });

  test("Foods nobody has logged are simply deleted", async ({ page }) => {
    const { token, unused, state } = await arrangeFoods("2001-06-26");
    await page.goto("/foods");
    await searchBox(page).fill(token);
    await hold(page, foodRow(page, unused[0].word));
    await foodRow(page, unused[1].word).click();

    await bar(page).getByRole("button", { name: "Delete" }).click();
    await expect(confirmSheet(page)).toContainText("Delete 2 foods?");
    await confirmSheet(page)
      .getByRole("button", { name: "Delete 2 foods" })
      .click();

    await expect(page.getByText("Removed 2 foods")).toBeVisible();
    await expect.poll(async () => (await state()).size).toBe(2);
  });

  test("a failed removal brings every Food back and offers to retry", async ({
    page,
  }) => {
    const { token, logged, unused } = await arrangeFoods("2001-06-27");
    await page.route("**/rest/v1/rpc/remove_foods*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await page.goto("/foods");
    await searchBox(page).fill(token);
    await hold(page, foodRow(page, logged[0].word));
    await foodRow(page, unused[0].word).click();
    await bar(page).getByRole("button", { name: "Delete" }).click();
    await confirmSheet(page)
      .getByRole("button", { name: /^Remove 2 foods$/ })
      .click();

    await expect(page.getByText("Couldn't remove those foods")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(foodList(page).getByRole("listitem")).toHaveCount(4);
  });
});
