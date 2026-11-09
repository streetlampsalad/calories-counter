import { expect, test } from "@playwright/test";
import { authFile } from "./support/auth";

// Settings in categories (spec 168).
test.use({ storageState: authFile("liv") });

test("each category opens its sections and back returns (US1.1, US1.3–US1.6)", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: /Tracking/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Preferences/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Features/ })).toBeVisible();

  await page.getByRole("link", { name: /Tracking/ }).click();
  await expect(page).toHaveURL(/\/settings\/tracking$/);
  await expect(page.getByRole("region", { name: "Daily goal" })).toBeVisible();
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
