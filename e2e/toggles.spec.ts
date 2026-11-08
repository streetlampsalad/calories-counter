import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";

// The Owner tries a Toggle in Testing from Settings (spec 116). liv is the seeded Owner, and
// feature-0 "Example feature" the seeded Toggle; these tests change liv's override, one at a time.
test.describe.configure({ mode: "serial" });

const section = (page: Page) =>
  page.getByRole("region", { name: "Try new features" });
const exampleSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Example feature" });

test.describe("the Owner", () => {
  test.use({ storageState: authFile("liv") });

  test.beforeEach(async () => {
    const liv = await userClient("liv");
    const { error } = await liv
      .from("toggle_overrides")
      .delete()
      .neq("toggle_key", "");
    if (error) throw error;
  });

  test("turns on a Toggle in Testing and it stays on (US2.1, US2.2)", async ({
    page,
  }) => {
    await page.goto("/settings");

    await expect(section(page)).toBeVisible();
    await expect(exampleSwitch(page)).not.toBeChecked();

    const saved = page.waitForResponse(
      (response) =>
        response.request().method() !== "GET" &&
        response.url().includes("/rest/v1/toggle_overrides"),
    );
    await exampleSwitch(page).click();
    await expect(exampleSwitch(page)).toBeChecked();
    await saved;

    await page.reload();
    await expect(exampleSwitch(page)).toBeChecked();
  });
});

test.describe("a User who is not the Owner", () => {
  test.use({ storageState: authFile("cleo") });

  test("sees no Try new features section (US2.4)", async ({ page }) => {
    await page.goto("/settings");

    await expect(
      page.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "About" })).toBeVisible();
    await expect(section(page)).toHaveCount(0);
  });
});
