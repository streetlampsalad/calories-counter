import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";

// Appearance (spec 147), behind Toggle feature-146. liv is the seeded Owner, who may turn it on
// for herself. These tests change liv's Toggle, one at a time.
test.describe.configure({ mode: "serial" });

const TOGGLE = "feature-146";

async function setToggle(on: boolean) {
  const liv = await userClient("liv");
  const { error } = await liv
    .from("toggle_overrides")
    .upsert(
      { toggle_key: TOGGLE, enabled: on },
      { onConflict: "toggle_key,user_id" },
    );
  if (error) throw error;
}

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

test.describe("with Appearance on", () => {
  test.use({ storageState: authFile("liv") });

  test.beforeEach(async () => setToggle(true));
  test.afterAll(async () => setToggle(false));

  test("is Light until a choice is made (US1.3)", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(await isDark(page)).toBe(false);
  });

  test("Dark applies at once and after a reload, and Light returns (US1.4, US1.6)", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.getByRole("radio", { name: "Dark" }).check();
    await expect.poll(() => isDark(page)).toBe(true);

    await page.reload();
    await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(await isDark(page)).toBe(true);

    await page.getByRole("radio", { name: "Light" }).check();
    await expect.poll(() => isDark(page)).toBe(false);
    await page.reload();
    await expect(page.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(await isDark(page)).toBe(false);
  });

  test("System follows the phone, including a change while open (US1.5)", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/settings");
    await page.getByRole("radio", { name: "System" }).check();
    await expect.poll(() => isDark(page)).toBe(true);

    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => isDark(page)).toBe(false);
  });

  test("a second phone starts Light (US1.8)", async ({ page, browser }) => {
    await page.goto("/settings");
    await page.getByRole("radio", { name: "Dark" }).check();
    await expect.poll(() => isDark(page)).toBe(true);

    const other = await browser.newContext({ storageState: authFile("liv") });
    const otherPage = await other.newPage();
    await otherPage.goto("/settings");
    await expect(otherPage.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(await isDark(otherPage)).toBe(false);
    await other.close();
  });
});

test.describe("with Appearance off", () => {
  test.use({ storageState: authFile("liv") });

  test.beforeEach(async () => setToggle(false));

  test("has no Appearance section (US1.2)", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Appearance")).toHaveCount(0);
  });

  test("clears a saved Dark once Toggles load off (US1.9)", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("theme", "dark");
        sessionStorage.setItem("seeded", "1");
      }
    });
    await page.goto("/settings");

    await expect.poll(() => isDark(page)).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
  });
});
