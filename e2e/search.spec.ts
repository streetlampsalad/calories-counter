import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";
import { seedFood, unique } from "./support/seed";

// The reference foods come from the fixture rows in supabase/seed.sql, whose source is not AFCD,
// so the form credits "a reference food" rather than the real database.
async function search(page: Page, text: string) {
  await page.getByLabel("Search for a food").fill(text);
  await page.getByRole("button", { name: "Search" }).click();
}
const australian = (page: Page) =>
  page.getByRole("list", { name: "Australian foods" });

test("Add food leads to search, and a search finds Australian foods", async ({
  page,
}) => {
  await page.goto("/foods");

  await page.getByRole("button", { name: "Add food" }).first().click();
  await page.getByRole("link", { name: /Search/ }).click();
  await expect(page).toHaveURL("/foods/search");
  await search(page, "banana");

  await expect(
    australian(page).getByRole("button", { name: /Banana, cavendish, raw/ }),
  ).toContainText("93 kcal per 100 g");
});

test("a typo still finds the food", async ({ page }) => {
  await page.goto("/foods/search");

  await search(page, "bananna");

  await expect(
    australian(page).getByRole("button", { name: /Banana, cavendish, raw/ }),
  ).toBeVisible();
});

test("one character is not enough", async ({ page }) => {
  await page.goto("/foods/search");

  await search(page, "b");

  await expect(page.getByText("Type at least 2 characters.")).toBeVisible();
  await expect(australian(page)).toHaveCount(0);
});

test("picking a food opens the form with its values, and saving adds it to the list", async ({
  page,
}) => {
  const name = unique("Search banana");
  await page.goto("/foods/search");
  await search(page, "banana");

  await australian(page)
    .getByRole("button", { name: /Banana, cavendish, raw/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Name")).toHaveValue("Banana, cavendish, raw");
  await expect(dialog.getByLabel("Portion")).toHaveValue("100 g");
  await expect(dialog.getByLabel("Calories")).toHaveValue("93");
  await expect(dialog.getByText("From a reference food")).toBeVisible();

  await dialog.getByLabel("Name").fill(name);
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/foods") &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Save" }).click();
  await saved;

  await expect(page.getByText(`Added ${name}`)).toBeVisible();
  await page.goto("/foods");
  await expect(
    page.getByRole("button", { name: new RegExp(`^Edit ${name},`) }),
  ).toContainText("100 g · 93 kcal");
});

test("a food already in the list shows first and opens that food instead", async ({
  page,
}) => {
  const ada = await userClient("ada");
  const token = unique("Quokka").replace(/\s/g, "");
  const mine = await seedFood(ada, {
    name: `${token} banana`,
    portion: "1 bowl",
    calories: 222,
  });
  await page.goto("/foods/search");

  await search(page, token);

  const yours = page.getByRole("list", { name: "Your foods" });
  await expect(yours).toContainText(`${token} banana`);
  await expect(yours).toContainText("1 bowl · 222 kcal");
  await yours.getByRole("link").click();
  await expect(page).toHaveURL("/foods");
  await expect(page.getByRole("heading", { name: "Edit food" })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(mine.name);
});

test("Your foods comes before Australian foods", async ({ page }) => {
  const ada = await userClient("ada");
  await seedFood(ada, {
    name: unique("Plantain banana"),
    portion: "1 piece",
    calories: 120,
  });
  await page.goto("/foods/search");

  await search(page, "banana");

  const headings = await page
    .getByRole("main")
    .getByRole("heading", { level: 2 })
    .allInnerTexts();
  expect(headings.slice(0, 2)).toEqual(["Your foods", "Australian foods"]);
});

test("the search fits a phone", async ({ page }) => {
  await page.goto("/foods/search");
  await search(page, "banana");

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("changing the portion to a gram amount rescales the calories, and the number can still be overridden", async ({
  page,
}) => {
  const name = unique("Scaled banana");
  await page.goto("/foods/search");
  await search(page, "banana");
  await australian(page)
    .getByRole("button", { name: /Banana, cavendish, raw/ })
    .click();
  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Portion").fill("150 g");
  await expect(dialog.getByLabel("Calories")).toHaveValue("140"); // 93 x 1.5 = 139.5

  await dialog.getByLabel("Portion").fill("1 cup");
  await expect(dialog.getByLabel("Calories")).toHaveValue("140"); // not a weight: left alone

  await dialog.getByLabel("Portion").fill("200 g");
  await expect(dialog.getByLabel("Calories")).toHaveValue("186");

  await dialog.getByLabel("Calories").fill("190");
  await dialog.getByLabel("Portion").fill("250 g");
  await expect(dialog.getByLabel("Calories")).toHaveValue("190");

  await dialog.getByLabel("Name").fill(name);
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/foods") &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Save" }).click();
  await saved;
  await page.goto("/foods");
  await expect(
    page.getByRole("button", { name: new RegExp(`^Edit ${name},`) }),
  ).toContainText("250 g · 190 kcal");
});

test("a liquid scales per 100 ml", async ({ page }) => {
  await page.goto("/foods/search");
  await search(page, "milk");
  await australian(page)
    .getByRole("button", { name: /Milk, cow, full fat/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Portion")).toHaveValue("100 ml");

  await dialog.getByLabel("Portion").fill("250 ml");

  await expect(dialog.getByLabel("Calories")).toHaveValue("163"); // 162.5
});

const packaged = (page: Page) =>
  page.getByRole("list", { name: "Packaged products" });

test("packaged products are listed with brand and energy", async ({ page }) => {
  await page.goto("/foods/search");

  await search(page, "tim tam");

  const first = packaged(page).getByRole("button").first();
  await expect(first).toContainText("Tim Tam");
  await expect(first).toContainText("Arnott's");
  await expect(first).toContainText("524 kcal per 100 g");
  await expect(first).toContainText("96 kcal per serving");
});

test("a packaged product asks per serving or per 100 g, then saves as chosen", async ({
  page,
}) => {
  const name = unique("Biscuit");
  await page.goto("/foods/search");
  await search(page, "tim tam");

  await packaged(page).getByRole("button").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Which do you want to save/)).toBeVisible();
  await dialog.getByRole("button", { name: /Per serving/ }).click();

  await expect(dialog.getByLabel("Name")).toHaveValue("Arnott's Tim Tam");
  await expect(dialog.getByLabel("Portion")).toHaveValue("1 biscuit (18.3 g)");
  await expect(dialog.getByLabel("Calories")).toHaveValue("96");
  await expect(dialog.getByText("From Open Food Facts")).toBeVisible();
  await dialog.getByLabel("Name").fill(name);
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/foods") &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Save" }).click();
  await saved;
  await page.goto("/foods");
  await expect(
    page.getByRole("button", { name: new RegExp(`^Edit ${name},`) }),
  ).toContainText("1 biscuit (18.3 g) · 96 kcal");
});

test("per 100 g from a product rescales to the portion typed", async ({
  page,
}) => {
  await page.goto("/foods/search");
  await search(page, "tim tam");
  await packaged(page).getByRole("button").first().click();
  const dialog = page.getByRole("dialog");

  await dialog.getByRole("button", { name: /Per 100 g/ }).click();
  await expect(dialog.getByLabel("Calories")).toHaveValue("524");
  await dialog.getByLabel("Portion").fill("30 g");

  await expect(dialog.getByLabel("Calories")).toHaveValue("157"); // 523.7 -> 524 x 0.3 = 157.2
});

test("when packaged products fail the section says so and the rest still shows", async ({
  page,
}) => {
  await page.route("**/api/search/products*", (route) =>
    route.fulfill({ status: 503, json: { code: "unavailable" } }),
  );
  await page.goto("/foods/search");

  await search(page, "banana");

  await expect(
    page.getByText("Packaged products unavailable right now"),
  ).toBeVisible();
  await expect(
    australian(page).getByRole("button", { name: /Banana, cavendish, raw/ }),
  ).toBeVisible();
});

test("the products endpoint refuses someone signed out", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const response = await context.request.get("/api/search/products?q=tim", {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(401);
  await context.close();
});

test("Best guess opens the form with a labelled estimate to check", async ({
  page,
}) => {
  const name = unique("Lamington");
  await page.goto("/foods/search");
  await search(page, "lamington");

  await page.getByRole("button", { name: /Best guess for/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Estimate: check before saving")).toBeVisible();
  await expect(dialog.getByText(/Basis:/)).toBeVisible();
  await expect(dialog.getByLabel("Name")).toHaveValue("Lamington");
  await expect(dialog.getByLabel("Portion")).toHaveValue("1 piece");
  await expect(dialog.getByLabel("Calories")).toHaveValue("190");
  await dialog.getByLabel("Name").fill(name);
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/foods") &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Save" }).click();
  await saved;
  await page.goto("/foods");
  await expect(
    page.getByRole("button", { name: new RegExp(`^Edit ${name},`) }),
  ).toContainText("1 piece · 190 kcal");
});

test("when Best guess is unavailable it says so and search carries on", async ({
  page,
}) => {
  await page.route("**/api/search/guess", (route) =>
    route.fulfill({ status: 503, json: { code: "guess_unavailable" } }),
  );
  await page.goto("/foods/search");
  await search(page, "banana");

  await page.getByRole("button", { name: /Best guess for/ }).click();

  await expect(
    page.getByRole("region", { name: "Best guess" }).getByRole("alert"),
  ).toContainText("isn't available right now");
  await expect(
    australian(page).getByRole("button", { name: /Banana, cavendish, raw/ }),
  ).toBeVisible();
});

test.describe("the guess endpoint", () => {
  test("refuses someone signed out", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const response = await context.request.post("/api/search/guess", {
      data: { query: "lamington" },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(401);
    await context.close();
  });

  test("turns away a query that is too short", async ({ request }) => {
    const response = await request.post("/api/search/guess", {
      data: { query: "a" },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe("the guess daily limit", () => {
  test.use({ storageState: authFile("ivy") });

  test("refuses with 429 once the day's guesses are used, whatever photos were read", async ({
    request,
  }) => {
    const send = () =>
      request.post("/api/search/guess", { data: { query: "lamington" } });

    let allowed = 0;
    let response = await send();
    while (response.status() === 200 && allowed < 31) {
      allowed += 1;
      response = await send();
    }

    expect(allowed).toBeLessThanOrEqual(30);
    expect(response.status()).toBe(429);
    expect(await response.json()).toEqual({ code: "limit_reached" });
  });
});

test("results carry the food data attribution, and Settings → About says the same", async ({
  page,
}) => {
  await page.goto("/foods/search");
  await expect(
    page.getByText(/Food Standards Australia New Zealand/),
  ).toHaveCount(0);

  await search(page, "banana");

  const attribution = page
    .getByRole("main")
    .getByText(/Australian Food Composition Database/);
  await expect(attribution).toContainText(
    "Food Standards Australia New Zealand",
  );
  await expect(attribution).toContainText("Open Database Licence");
  await expect(
    attribution.getByRole("link", { name: "Open Food Facts" }),
  ).toHaveAttribute("href", "https://world.openfoodfacts.org");

  await page.goto("/settings");
  await expect(
    page
      .getByRole("region", { name: "About" })
      .getByText(/Australian Food Composition Database/),
  ).toContainText("Open Database Licence");
});
