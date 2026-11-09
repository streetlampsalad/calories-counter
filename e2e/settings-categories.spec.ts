import { expect, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";

// Settings in categories (spec 168), behind Toggle feature-167. liv is the seeded Owner, who may
// switch a Toggle in Testing for themselves.
test.describe.configure({ mode: "serial" });
test.use({ storageState: authFile("liv") });

async function setToggle(on: boolean) {
  const liv = await userClient("liv");
  const { error } = await liv
    .from("toggle_overrides")
    .upsert(
      { toggle_key: "feature-167", enabled: on },
      { onConflict: "toggle_key,user_id" },
    );
  if (error) throw error;
}

test.describe("with the Toggle on", () => {
  test.beforeEach(() => setToggle(true));

  test("each category opens its sections and back returns (US1.1, US1.3–US1.6)", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: /Tracking/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Preferences/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Features/ })).toBeVisible();

    await page.getByRole("link", { name: /Tracking/ }).click();
    await expect(page).toHaveURL(/\/settings\/tracking$/);
    await expect(
      page.getByRole("region", { name: "Daily goal" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", {
        name: "Settings",
      }),
    ).toHaveAttribute("aria-current", "page");
    await page
      .getByRole("main")
      .getByRole("link", { name: "Settings", exact: true })
      .click();
    await expect(page).toHaveURL(/\/settings$/);

    await page.getByRole("link", { name: /Preferences/ }).click();
    await expect(page.getByRole("radio", { name: "Dark" })).toBeVisible();
    await page.goBack();

    await page.getByRole("link", { name: /Features/ }).click();
    await expect(
      page.getByRole("link", { name: /Feature requests/ }),
    ).toBeVisible();
  });
});

test.describe("with the Toggle off", () => {
  test.beforeEach(() => setToggle(false));

  test("Settings is the single list and category links redirect (US1.2, US1.8)", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: /Tracking/ })).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Daily goal" }),
    ).toBeVisible();

    await page.goto("/settings/tracking");
    await expect(page).toHaveURL(/\/settings$/);
  });
});
