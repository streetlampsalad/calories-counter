import { expect, test } from "@playwright/test";
import { authFile, TEST_USERS } from "./support/auth";
import { adminClient, userClient } from "./support/db";

// Report a bug (spec 194). liv is the seeded Owner, who can switch feature-192 on for themselves;
// GitHub is faked (FEATURE_ISSUES=fake). These tests change liv's Toggle and Bug reports, one at a
// time.
test.describe.configure({ mode: "serial" });

test.describe("a User with feature-192 on", () => {
  test.use({ storageState: authFile("liv") });

  test.beforeEach(async () => {
    const liv = await userClient("liv");
    const { error } = await liv
      .from("toggle_overrides")
      .upsert(
        { toggle_key: "feature-192", enabled: true },
        { onConflict: "toggle_key,user_id" },
      );
    if (error) throw error;
    const cleared = await adminClient()
      .from("bug_reports")
      .delete()
      .eq("user_id", TEST_USERS.liv.id);
    if (cleared.error) throw cleared.error;
  });

  test.afterEach(async () => {
    const liv = await userClient("liv");
    const { error } = await liv
      .from("toggle_overrides")
      .delete()
      .eq("toggle_key", "feature-192");
    if (error) throw error;
  });

  test("reports a bug from Settings → Features and sees Sent with an Issue number (US1.1, US1.8)", async ({
    page,
  }) => {
    await page.goto("/settings/features");
    await page.getByRole("link", { name: /Report a bug/ }).click();

    await expect(page).toHaveURL(/\/settings\/report-a-bug$/);
    await expect(page.getByText(/posted publicly on GitHub/)).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Attached to your report" }),
    ).toContainText("Report a bug (feature-192): Testing");

    await page
      .getByRole("textbox", { name: /What went wrong/ })
      .fill("The Today total ignores the last Entry I added");
    await page
      .getByRole("radio", { name: "It's annoying, but I can work around it" })
      .check();
    await page.getByRole("button", { name: "Send report" }).click();

    const sent = page.getByRole("status");
    await expect(sent).toContainText("Sent");
    await expect(sent.getByRole("link", { name: /#\d{5,6}/ })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /What went wrong/ }),
    ).toHaveValue("");

    const { data } = await adminClient()
      .from("bug_reports")
      .select("bug_issue")
      .eq("user_id", TEST_USERS.liv.id)
      .single();
    expect(data?.bug_issue).toBeGreaterThan(90000);
  });
});

test.describe("a User with feature-192 off", () => {
  test.use({ storageState: authFile("cleo") });

  test("has no row and the page is not found (US1.2)", async ({ page }) => {
    await page.goto("/settings/features");
    await expect(
      page.getByRole("heading", { name: "Features", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Report a bug/ })).toHaveCount(
      0,
    );

    await page.goto("/settings/report-a-bug");
    await expect(
      page.getByRole("heading", { name: "Report a bug" }),
    ).toHaveCount(0);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
  });
});
