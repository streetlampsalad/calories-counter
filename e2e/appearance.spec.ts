import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";

// Appearance (spec 147).

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

test.describe("Appearance", () => {
  test.use({ storageState: authFile("liv") });

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

test.describe("first frame and chrome", () => {
  test.use({ storageState: authFile("liv") });

  test("Dark saved is dark before hydration, with a matching theme colour (US2.1, US2.2)", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.route("**/_next/static/chunks/**", (route) => route.abort());
    await page.goto("/settings", { waitUntil: "domcontentloaded" });

    expect(await isDark(page)).toBe(true);
    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(bg).not.toBe("rgb(255, 255, 255)");

    await page.unrouteAll();
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Array.from(
            document.querySelectorAll<HTMLMetaElement>(
              'meta[name="theme-color"]',
            ),
          ).map((m) => m.content),
        ),
      )
      .toEqual(expect.arrayContaining(["#0a0a0a"]));
  });

  test("nothing saved leaves the page and theme colours as today (US2.4)", async ({
    page,
  }) => {
    await page.goto("/settings");
    expect(await isDark(page)).toBe(false);
    const colours = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
      ).map((m) => m.content),
    );
    expect(colours).toEqual(["#ffffff", "#0a0a0a"]);
  });
});
