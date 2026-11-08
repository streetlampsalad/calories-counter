import { expect, test } from "@playwright/test";
import { authFile, TEST_USERS } from "./support/auth";
import { adminClient, userClient } from "./support/db";

// Feature Requests (spec 124), behind Toggle feature-114. liv is the seeded Owner, who may turn it
// on for herself; GitHub is faked (FEATURE_ISSUES=fake). These tests change liv's requests, one at a time.
test.describe.configure({ mode: "serial" });

const TOGGLE = "feature-114";

test.describe("the Owner, with Feature Requests on", () => {
  test.use({ storageState: authFile("liv") });

  test.beforeEach(async () => {
    const liv = await userClient("liv");
    const { error } = await liv
      .from("toggle_overrides")
      .upsert(
        { toggle_key: TOGGLE, enabled: true },
        { onConflict: "toggle_key,user_id" },
      );
    if (error) throw error;
    const cleared = await adminClient()
      .from("feature_requests")
      .delete()
      .eq("user_id", TEST_USERS.liv.id);
    if (cleared.error) throw cleared.error;
  });

  test("asks for a feature from Settings and sees it Submitted (US1.1, US1.5)", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: /Feature requests/ }).click();

    await expect(page).toHaveURL(/\/settings\/feature-requests$/);
    await expect(page.getByText("Nothing requested yet.")).toBeVisible();

    await page.getByRole("link", { name: "Request a feature" }).click();
    await expect(page.getByText(/posted publicly on GitHub/)).toBeVisible();
    await page
      .getByRole("textbox", { name: /What would you like to be able to do/ })
      .fill("See how much water I drink each day");
    await page
      .getByRole("textbox", { name: /What's getting in the way today/ })
      .fill("I track water on paper, and forget to");
    await page.getByRole("button", { name: "Send request" }).click();

    await expect(page).toHaveURL(/\/settings\/feature-requests$/);
    const card = page.getByRole("article", {
      name: "See how much water I drink each day",
    });
    await expect(card).toBeVisible();
    await expect(card.getByText("Submitted")).toBeVisible();

    const { data } = await adminClient()
      .from("feature_requests")
      .select("feature_issue, problem")
      .eq("user_id", TEST_USERS.liv.id)
      .single();
    expect(data?.feature_issue).toBeGreaterThan(90000);
    expect(data?.problem).toBe("I track water on paper, and forget to");
  });
});

test.describe("a User without the Toggle", () => {
  test.use({ storageState: authFile("cleo") });

  test("has no way in, and the pages are not found (US1.2)", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByRole("region", { name: "About" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Feature requests/ }),
    ).toHaveCount(0);

    await page.goto("/settings/feature-requests");
    await expect(page.getByText("This page could not be found.")).toBeVisible();

    await page.goto("/settings/feature-requests/new");
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  });
});
