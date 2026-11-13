import { expect, test } from "@playwright/test";
import { authFile, TEST_USERS } from "./support/auth";
import { adminClient, userClient } from "./support/db";

// Report a bug (spec 194). GitHub is faked (FEATURE_ISSUES=fake). These tests change liv's Bug
// reports, one at a time.
test.describe.configure({ mode: "serial" });

test.describe("a signed-in User", () => {
  test.use({ storageState: authFile("liv") });

  test.beforeEach(async () => {
    const cleared = await adminClient()
      .from("bug_reports")
      .delete()
      .eq("user_id", TEST_USERS.liv.id);
    if (cleared.error) throw cleared.error;
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
    ).toContainText("Report a bug (feature-192): Live");

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

  // The board's sync (Slice 3). The route is machine to machine: it takes the shared secret, not a
  // session. The Feature Request sync's secret is the one the e2e server is given.
  const SECRET = "e2e-feature-requests-sync-secret";
  const ISSUE = 99_301;

  async function addReport() {
    const { data, error } = await adminClient()
      .from("bug_reports")
      .insert({ user_id: TEST_USERS.liv.id, bug_issue: ISSUE })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  test("a sync marking a report Not going ahead shows the reason and the Feature requests link (US3.5, US3.6)", async ({
    page,
    request,
  }) => {
    const id = await addReport();

    await page.goto("/settings/report-a-bug");
    const row = page
      .getByRole("list", { name: "Your bug reports" })
      .getByRole("listitem");
    await expect(row).toContainText(`Bug #${ISSUE}`);
    await expect(row).toContainText("Sent");

    const sync = await request.post("/api/bug-reports/sync", {
      headers: { "x-sync-secret": SECRET },
      data: {
        updates: [
          {
            id,
            bug_issue: ISSUE,
            outcome: "not_going_ahead",
            issue_title: "Bug: the Today total is wrong",
            latest_comment:
              "The app works as specified, so this is a new feature.",
          },
        ],
      },
    });
    expect(sync.status()).toBe(200);
    expect(await sync.json()).toEqual({ applied: 1, notified: 0 });

    await page.goto("/settings/report-a-bug");
    await expect(row).toContainText("Bug: the Today total is wrong");
    await expect(row).toContainText("Not going ahead");
    await expect(row).toContainText(
      "The app works as specified, so this is a new feature.",
    );
    await row
      .getByRole("link", {
        name: "Is it something new? Ask for it as a feature.",
      })
      .click();
    await expect(page).toHaveURL(/\/settings\/feature-requests$/);
  });

  test("refuses a sync with the wrong secret, and changes nothing (US3.4)", async ({
    request,
  }) => {
    const id = await addReport();

    const sync = await request.post("/api/bug-reports/sync", {
      headers: { "x-sync-secret": "not-the-secret" },
      data: {
        updates: [
          {
            id,
            bug_issue: ISSUE,
            outcome: "fixed",
            issue_title: "Bug: x",
            latest_comment: null,
          },
        ],
      },
    });

    expect(sync.status()).toBe(401);
    const { data } = await adminClient()
      .from("bug_reports")
      .select("outcome")
      .eq("id", id)
      .single();
    expect(data?.outcome).toBeNull();
  });

  test("another User reads none of this User's outcomes or reasons (US3.9)", async () => {
    const id = await addReport();
    const { error } = await adminClient()
      .from("bug_reports")
      .update({
        outcome: "not_going_ahead",
        latest_comment: "A private reason",
      })
      .eq("id", id);
    if (error) throw error;

    const cleo = await userClient("cleo");
    const { data, error: readError } = await cleo
      .from("bug_reports")
      .select("id, outcome, latest_comment")
      .eq("id", id);
    if (readError) throw readError;
    expect(data).toEqual([]);
  });

  test("shows the device from Client Hints in the preview and still sends (US2.1, US2.4)", async ({
    page,
  }) => {
    // The Pixel 7 preset overrides only the user-agent string, so Client Hints are stubbed.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "userAgentData", {
        configurable: true,
        value: {
          brands: [
            { brand: "Not.A/Brand", version: "99" },
            { brand: "Chromium", version: "142" },
            { brand: "Google Chrome", version: "142" },
          ],
          platform: "Android",
          getHighEntropyValues: async () => ({
            model: "Pixel 7",
            platformVersion: "16.0.0",
          }),
        },
      });
    });
    await page.goto("/settings/report-a-bug");

    const attached = page.getByRole("region", {
      name: "Attached to your report",
    });
    await expect(attached).toContainText("Model: Pixel 7");
    await expect(attached).toContainText("Operating system: Android 16");
    await expect(attached).toContainText("Browser: Chrome 142");
    await expect(attached).toContainText("Opened as: Browser tab");

    await page
      .getByRole("textbox", { name: /What went wrong/ })
      .fill("The Today total ignores the last Entry I added");
    await page
      .getByRole("radio", { name: "It's annoying, but I can work around it" })
      .check();
    await page.getByRole("button", { name: "Send report" }).click();

    await expect(page.getByRole("status")).toContainText("Sent");
  });
});

// The board workflow calls the sync with only the shared secret: no session, like production.
test.describe("the board workflow, signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("reaches the sync with the secret alone (Bug #216)", async ({
    request,
  }) => {
    const sync = await request.post("/api/bug-reports/sync", {
      headers: { "x-sync-secret": "e2e-feature-requests-sync-secret" },
      data: { updates: [] },
    });

    expect(sync.status()).toBe(200);
    expect(await sync.json()).toEqual({ applied: 0, notified: 0 });
  });

  test("is still refused with the wrong secret (Bug #216)", async ({
    request,
  }) => {
    const sync = await request.post("/api/bug-reports/sync", {
      headers: { "x-sync-secret": "not-the-secret" },
      data: { updates: [] },
    });

    expect(sync.status()).toBe(401);
  });
});
