import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";

// Tests share ada's Food List, so every Food gets a unique name and nothing counts rows.
const unique = (base: string) =>
  `${base} ${Math.random().toString(36).slice(2, 8)}`;

// Adds a Food through the sheet and waits for the sheet to finish closing. Without that wait the
// next step can find two sheets mid-animation. Pass stayOpen when the save is expected to be refused.
async function addFood(
  page: Page,
  name: string,
  portion: string,
  calories: string,
  { stayOpen = false } = {},
) {
  await page.getByRole("button", { name: "Add food" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Portion").fill(portion);
  await page.getByLabel("Calories").fill(calories);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  if (!stayOpen) await expect(page.getByRole("dialog")).toHaveCount(0);
}

const list = (page: Page) => page.getByRole("list", { name: "Your foods" });

test.describe("an empty Food List", () => {
  test.use({ storageState: authFile("cleo") });

  test("explains what Foods are and offers to add one", async ({ page }) => {
    await page.goto("/foods");

    await expect(
      page.getByRole("heading", { name: "No foods yet" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add food" })).toBeVisible();
  });
});

test("a new Food appears in the list straight away, and is still there after a reload", async ({
  page,
}) => {
  const name = unique("Sourdough toast");
  await page.goto("/foods");

  await addFood(page, name, "1 slice", "110");

  const row = list(page).getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("1 slice · 110 kcal");

  await page.reload();
  await expect(
    list(page).getByRole("listitem").filter({ hasText: name }),
  ).toBeVisible();
});

test("Foods are listed alphabetically", async ({ page }) => {
  const suffix = unique("sort");
  const early = `Aaa ${suffix}`;
  const late = `Zzz ${suffix}`;
  await page.goto("/foods");

  await addFood(page, late, "1 piece", "10");
  await expect(list(page).getByText(late)).toBeVisible();
  await addFood(page, early, "1 piece", "10");
  await expect(list(page).getByText(early)).toBeVisible();

  const names = await list(page).getByRole("listitem").allInnerTexts();
  const position = (name: string) =>
    names.findIndex((text) => text.startsWith(name));
  expect(position(early)).toBeGreaterThanOrEqual(0);
  expect(position(early)).toBeLessThan(position(late));
});

test("an incomplete form says what is missing and saves nothing", async ({
  page,
}) => {
  await page.goto("/foods");
  await page.getByRole("button", { name: "Add food" }).click();

  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText("Enter a name")).toBeVisible();
  await expect(
    page.getByText("Calories must be a whole number from 0 to 9,999"),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("the same name and Portion cannot be added twice, whatever the case", async ({
  page,
}) => {
  const name = unique("Duplicate bread");
  await page.goto("/foods");
  await addFood(page, name, "1 slice", "90");
  await expect(list(page).getByText(name)).toBeVisible();

  await addFood(page, name.toUpperCase(), "1 SLICE", "95", { stayOpen: true });

  await expect(
    page.getByText(`You already have ${name.toUpperCase()}`, { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("the Foods screen fits a phone without sideways scrolling", async ({
  page,
}) => {
  await page.goto("/foods");
  await expect(page.getByRole("heading", { name: "Foods" })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
});

test.describe("searching the Food List", () => {
  test("filters on every keystroke without asking the server", async ({
    page,
  }) => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const cafe = `Café latte ${suffix}`;
    const toast = `Sourdough toast ${suffix}`;
    // Loading the list, and each background refresh that follows adding a Food, must land
    // before the typing starts; otherwise a late response would be mistaken for a search request.
    const listResponse = () =>
      page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          response.url().includes("/rest/v1/foods?select="),
      );
    const loaded = listResponse();
    await page.goto("/foods");
    await loaded;

    for (const [name, portion, calories] of [
      [cafe, "250 ml", "120"],
      [toast, "1 slice", "110"],
    ]) {
      const refreshed = listResponse();
      await addFood(page, name, portion, calories);
      await refreshed;
    }
    await expect(list(page).getByText(cafe)).toBeVisible();
    await expect(list(page).getByText(toast)).toBeVisible();

    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes(":54321")) requests.push(request.url());
    });

    const search = page.getByRole("searchbox", { name: "Search foods" });
    await search.fill(`cafe ${suffix}`);
    await expect(list(page).getByText(cafe)).toBeVisible();
    await expect(list(page).getByText(toast)).toHaveCount(0);

    await search.fill(`TOA ${suffix}`);
    await expect(list(page).getByText(toast)).toBeVisible();
    await expect(list(page).getByText(cafe)).toHaveCount(0);

    expect(requests).toEqual([]);
  });

  test("says when nothing matches, and clearing brings the list back", async ({
    page,
  }) => {
    const name = unique("Rice");
    await page.goto("/foods");
    await addFood(page, name, "100 g", "130");
    await expect(list(page).getByText(name)).toBeVisible();

    const search = page.getByRole("searchbox", { name: "Search foods" });
    await search.fill("zzzzqqqq");
    await expect(page.getByText("No foods match")).toBeVisible();

    await page.getByRole("button", { name: "Clear search" }).first().click();
    await expect(search).toHaveValue("");
    await expect(list(page).getByText(name)).toBeVisible();
  });
});

test.describe("editing a Food", () => {
  const rowFor = (page: Page, name: string) =>
    list(page).getByRole("listitem").filter({ hasText: name });

  async function openEditor(page: Page, name: string) {
    await page
      .getByRole("button", { name: new RegExp(`^Edit ${name}`) })
      .click();
    await expect(
      page.getByRole("heading", { name: "Edit food" }),
    ).toBeVisible();
  }

  test("changes show in the list straight away and survive a reload", async ({
    page,
  }) => {
    const name = unique("Edit me");
    await page.goto("/foods");
    await addFood(page, name, "1 piece", "100");
    await expect(rowFor(page, name)).toContainText("100 kcal");

    await openEditor(page, name);
    await page.getByLabel("Calories").fill("175");
    await page.getByLabel("Portion").fill("2 pieces");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(rowFor(page, name)).toContainText("2 pieces · 175 kcal");
    await page.reload();
    await expect(rowFor(page, name)).toContainText("2 pieces · 175 kcal");
  });

  test("a failed save puts the old values back and offers to retry", async ({
    page,
  }) => {
    const name = unique("Rollback");
    await page.goto("/foods");
    await addFood(page, name, "1 piece", "100");
    await expect(rowFor(page, name)).toContainText("100 kcal");

    await page.route("**/rest/v1/foods?*", (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            body: "{}",
          })
        : route.continue(),
    );
    await openEditor(page, name);
    await page.getByLabel("Calories").fill("999");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText(`Couldn't save ${name}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(rowFor(page, name)).toContainText("100 kcal");
    await expect(rowFor(page, name)).not.toContainText("999");
  });

  test("renaming into another Food's name and Portion is refused", async ({
    page,
  }) => {
    const first = unique("First");
    const second = unique("Second");
    await page.goto("/foods");
    await addFood(page, first, "1 cup", "50");
    await expect(rowFor(page, first)).toBeVisible();
    await addFood(page, second, "1 cup", "60");
    await expect(rowFor(page, second)).toBeVisible();

    await openEditor(page, second);
    await page.getByLabel("Name").fill(first);
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(
      page.getByText(`You already have ${first} (1 cup)`),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Edit food" }),
    ).toBeVisible();
  });
});

test.describe("removing a Food", () => {
  const rowFor = (page: Page, name: string) =>
    list(page).getByRole("listitem").filter({ hasText: name });

  async function openEditor(page: Page, name: string) {
    await page
      .getByRole("button", { name: new RegExp(`^Edit ${name}`) })
      .click();
    await expect(
      page.getByRole("heading", { name: "Edit food" }),
    ).toBeVisible();
  }

  test("a Food with no Entries can be deleted for good, after confirming", async ({
    page,
  }) => {
    const name = unique("Delete me");
    await page.goto("/foods");
    await addFood(page, name, "1 piece", "80");
    await expect(rowFor(page, name)).toBeVisible();

    await openEditor(page, name);
    await page.getByRole("button", { name: "Delete food" }).click();
    await expect(page.getByText(`Delete ${name} for good?`)).toBeVisible();
    await page.getByRole("button", { name: "Yes, delete" }).click();

    await expect(rowFor(page, name)).toHaveCount(0);
    await expect(page.getByText(`Deleted ${name}`)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Add food" })).toBeVisible();
    await expect(rowFor(page, name)).toHaveCount(0);
  });

  test("cancelling the confirmation keeps the Food", async ({ page }) => {
    const name = unique("Keep me");
    await page.goto("/foods");
    await addFood(page, name, "1 piece", "80");
    await expect(rowFor(page, name)).toBeVisible();

    await openEditor(page, name);
    await page.getByRole("button", { name: "Delete food" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.keyboard.press("Escape");

    await expect(rowFor(page, name)).toBeVisible();
  });

  test("an Archived Food leaves the list, shows under Archived foods, and can be restored", async ({
    page,
  }) => {
    const name = unique("Archive me");
    await page.goto("/foods");
    await addFood(page, name, "1 slice", "300");
    await expect(rowFor(page, name)).toBeVisible();

    // Archive it directly: the UI only archives Foods with Entries, which arrive with spec 008.
    const ada = await userClient("ada");
    const { error } = await ada
      .from("foods")
      .update({ archived_at: new Date().toISOString() })
      .eq("name", name);
    expect(error).toBeNull();

    await page.reload();
    await expect(rowFor(page, name)).toHaveCount(0);

    await page.getByRole("link", { name: "Archived foods" }).click();
    await expect(
      page.getByRole("heading", { name: "Archived foods" }),
    ).toBeVisible();
    const archivedRow = page
      .getByRole("list", { name: "Archived foods" })
      .getByRole("listitem")
      .filter({ hasText: name });
    await expect(archivedRow).toContainText("1 slice · 300 kcal");

    await page.getByRole("button", { name: `Restore ${name}` }).click();
    await expect(archivedRow).toHaveCount(0);
    await expect(page.getByText(`Restored ${name}`)).toBeVisible();

    await page
      .getByRole("link", { name: "Foods", exact: true })
      .first()
      .click();
    await expect(rowFor(page, name)).toContainText("1 slice · 300 kcal");
  });

  test("restoring is refused while a live Food has the same name and Portion", async ({
    page,
  }) => {
    const name = unique("Clash");
    await page.goto("/foods");
    await addFood(page, name, "1 slice", "300");
    await expect(rowFor(page, name)).toBeVisible();
    const ada = await userClient("ada");
    await ada
      .from("foods")
      .update({ archived_at: new Date().toISOString() })
      .eq("name", name);
    await page.reload();
    await addFood(page, name, "1 slice", "310");
    await expect(rowFor(page, name)).toContainText("310 kcal");

    await page.goto("/foods/archived");
    await page.getByRole("button", { name: `Restore ${name}` }).click();

    await expect(
      page.getByText(`You already have ${name} (1 slice)`),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Restore ${name}` }),
    ).toBeVisible();
  });
});

test.describe("with nothing archived", () => {
  test.use({ storageState: authFile("cleo") });

  test("Archived foods says so", async ({ page }) => {
    await page.goto("/foods/archived");

    await expect(page.getByText("No archived foods.")).toBeVisible();
  });
});

test("the Foods tab opens the Food List", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Foods" })
    .click();

  await expect(page).toHaveURL("/foods");
  await expect(
    page.getByRole("heading", { name: "Foods", exact: true }),
  ).toBeVisible();
});
