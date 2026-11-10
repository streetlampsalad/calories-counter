import { expect, test } from "@playwright/test";
import { authFile, TEST_USERS } from "./support/auth";
import { adminClient } from "./support/db";

// Feature Requests (spec 124). liv is the seeded Owner; GitHub is faked (FEATURE_ISSUES=fake). These tests change liv's requests, one at a time.
test.describe.configure({ mode: "serial" });

test.describe("the Owner", () => {
  test.use({ storageState: authFile("liv") });

  test.beforeEach(async () => {
    const cleared = await adminClient()
      .from("feature_requests")
      .delete()
      .eq("user_id", TEST_USERS.liv.id);
    if (cleared.error) throw cleared.error;
  });

  test("asks for a feature from Settings and sees it Submitted (US1.1, US1.5)", async ({
    page,
  }) => {
    await page.goto("/settings/features");
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

  test("withdraws a request before building starts (US4.1)", async ({
    page,
  }) => {
    const { error } = await adminClient().from("feature_requests").insert({
      user_id: TEST_USERS.liv.id,
      goal: "Copy yesterday's Entries to today",
      feature_issue: 99_201,
      stage: "submitted",
    });
    if (error) throw error;

    await page.goto("/settings/feature-requests");
    const card = page.getByRole("article", {
      name: "Copy yesterday's Entries to today",
    });
    await card.getByRole("button", { name: "Withdraw" }).click();
    await page
      .getByRole("dialog", { name: "Withdraw this request?" })
      .getByRole("button", { name: "Withdraw request" })
      .click();

    await expect(card).toContainText("Withdrawn");
    await expect(card.getByRole("button", { name: "Withdraw" })).toHaveCount(0);
    const { data } = await adminClient()
      .from("feature_requests")
      .select("withdrawn_at")
      .eq("feature_issue", 99_201)
      .single();
    expect(data?.withdrawn_at).not.toBeNull();
  });
});

test.describe("stages from the board workflow (Slice 2)", () => {
  test.use({ storageState: authFile("liv") });

  const SECRET = "e2e-feature-requests-sync-secret";
  const MINE = 99_101;
  const THEIRS = 99_102;

  async function clear() {
    const { error } = await adminClient()
      .from("feature_requests")
      .delete()
      .in("feature_issue", [MINE, THEIRS]);
    if (error) throw error;
    const toggle = await adminClient()
      .from("toggles")
      .delete()
      .eq("key", `feature-${MINE}`);
    if (toggle.error) throw toggle.error;
  }

  test.beforeEach(async () => {
    await clear();
    const { error } = await adminClient()
      .from("feature_requests")
      .insert([
        {
          user_id: TEST_USERS.liv.id,
          goal: "See how much water I drink",
          feature_issue: MINE,
          stage: "submitted",
        },
        {
          user_id: TEST_USERS.bea.id,
          goal: "Scan barcodes on packaged food",
          feature_issue: THEIRS,
          stage: "building",
        },
      ]);
    if (error) throw error;
  });

  test.afterEach(clear);

  test("a sync moves a request on, and the card says so (US2.1)", async ({
    page,
    request,
  }) => {
    const sync = await request.post("/api/feature-requests/sync", {
      headers: { "x-sync-secret": SECRET },
      data: {
        requests: [
          {
            featureIssue: MINE,
            stage: "planning",
            specIssue: MINE + 1,
            latestComment: "Accepted: specified in the Spec",
            readyNote: null,
          },
        ],
      },
    });
    expect(sync.status()).toBe(200);
    expect(await sync.json()).toEqual({
      updated: 1,
      notified: 0,
      reminded: 0,
    });

    await page.goto("/settings/feature-requests");
    const card = page.getByRole("article", {
      name: "See how much water I drink",
      exact: true,
    });
    await expect(card).toContainText("Planning");
    await expect(card).toContainText("Accepted: specified in the Spec");
  });

  test("refuses a sync without the secret (US2.3)", async ({ request }) => {
    const sync = await request.post("/api/feature-requests/sync", {
      headers: { "x-sync-secret": "not-the-secret" },
      data: { requests: [] },
    });
    expect(sync.status()).toBe(401);
  });

  test("shows another User's request in progress, without who asked (US2.4)", async ({
    page,
  }) => {
    await page.goto("/settings/feature-requests");

    const others = page.getByRole("list", { name: "Others are asking for" });
    await expect(others).toContainText("Scan barcodes on packaged food");
    await expect(others).toContainText("Building");
    await expect(others).not.toContainText(TEST_USERS.bea.email);
  });

  test("a request Ready to try shows what was built, and its switch turns it on (US3.4, US3.5)", async ({
    page,
    request,
  }) => {
    // The feature's first Slice would add its Toggle; here the test does.
    const added = await adminClient()
      .from("toggles")
      .insert({ key: `feature-${MINE}`, title: "Water tracking" });
    if (added.error) throw added.error;

    const sync = await request.post("/api/feature-requests/sync", {
      headers: { "x-sync-secret": SECRET },
      data: {
        requests: [
          {
            featureIssue: MINE,
            stage: "ready_to_try",
            specIssue: MINE + 1,
            latestComment: "In production",
            readyNote: "Open Today and tap Water to add a glass.",
          },
        ],
      },
    });
    expect(sync.status()).toBe(200);

    await page.goto("/settings/feature-requests");
    const card = page.getByRole("article", {
      name: "See how much water I drink",
      exact: true,
    });
    await expect(card).toContainText("Ready to try");
    await expect(card).toContainText(
      "Open Today and tap Water to add a glass.",
    );

    const tryIt = card.getByRole("switch", { name: "Try it" });
    await expect(tryIt).not.toBeChecked();
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() !== "GET" &&
        response.url().includes("/rest/v1/toggle_overrides"),
    );
    await tryIt.click();
    await saved;
    await page.reload();
    await expect(
      page
        .getByRole("article", {
          name: "See how much water I drink",
          exact: true,
        })
        .getByRole("switch", { name: "Try it" }),
    ).toBeChecked();
  });

  test("feedback in sets on a request Ready to try starts another Round (spec 135 US1.3, spec 193 US1.6)", async ({
    page,
  }) => {
    const added = await adminClient()
      .from("toggles")
      .insert({ key: `feature-${MINE}`, title: "Water tracking" });
    if (added.error) throw added.error;
    const ready = await adminClient()
      .from("feature_requests")
      .update({ stage: "ready_to_try" })
      .eq("feature_issue", MINE);
    if (ready.error) throw ready.error;

    await page.goto("/settings/feature-requests");
    const card = page.getByRole("article", {
      name: "See how much water I drink",
      exact: true,
    });
    await card.getByRole("button", { name: "Give feedback" }).click();
    const sheet = page.getByRole("dialog", { name: "What should change?" });
    await expect(sheet).toContainText("posted publicly on GitHub");
    const set = (n: number) => sheet.getByRole("group", { name: `Set ${n}` });

    await set(1)
      .getByRole("textbox", { name: "Set 1" })
      .fill("The glass button does nothing");
    await set(1).getByRole("radio", { name: "Bug" }).check();
    await sheet.getByRole("button", { name: "Add another set" }).click();
    await set(2)
      .getByRole("textbox", { name: "Set 2" })
      .fill("Let me add half a glass");
    await sheet.getByRole("button", { name: "Add another set" }).click();
    await set(3)
      .getByRole("textbox", { name: "Set 3" })
      .fill("Remember my usual glass size");
    await sheet.getByRole("button", { name: "Send feedback" }).click();

    await expect(sheet).toBeHidden();
    await expect(card).toContainText("Submitted");
    await expect(card.getByRole("list", { name: "Rounds" })).toContainText(
      "The glass button does nothing",
    );
    await expect(card.getByRole("switch", { name: "Try it" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Withdraw" })).toHaveCount(0);

    const { data } = await adminClient()
      .from("feature_requests")
      .select("stage, feature_request_rounds (feedback, sets, feature_issue)")
      .eq("feature_issue", MINE)
      .single();
    expect(data?.stage).toBe("submitted");
    expect(data?.feature_request_rounds).toEqual([
      {
        feedback: "The glass button does nothing",
        sets: [
          { category: "bug", text: "The glass button does nothing" },
          { category: "enhancement", text: "Let me add half a glass" },
          { category: "enhancement", text: "Remember my usual glass size" },
        ],
        feature_issue: expect.any(Number),
      },
    ]);
  });
  test("marking a request ready turns it on for everyone (spec 135 US2.1)", async ({
    page,
  }) => {
    const added = await adminClient()
      .from("toggles")
      .insert({ key: `feature-${MINE}`, title: "Water tracking" });
    if (added.error) throw added.error;
    const ready = await adminClient()
      .from("feature_requests")
      .update({ stage: "ready_to_try" })
      .eq("feature_issue", MINE);
    if (ready.error) throw ready.error;

    await page.goto("/settings/feature-requests");
    const card = page.getByRole("article", {
      name: "See how much water I drink",
      exact: true,
    });
    await card.getByRole("button", { name: "It's ready" }).click();
    await page
      .getByRole("dialog", { name: "Turn it on for everyone?" })
      .getByRole("button", { name: "Turn it on for everyone" })
      .click();

    await expect(card).toContainText("Live for everyone");
    await expect(card.getByRole("button", { name: "It's ready" })).toHaveCount(
      0,
    );
    await expect(card.getByRole("switch", { name: "Try it" })).toHaveCount(0);

    const toggle = await adminClient()
      .from("toggles")
      .select("state")
      .eq("key", `feature-${MINE}`)
      .single();
    expect(toggle.data?.state).toBe("live");
    const { data } = await adminClient()
      .from("feature_requests")
      .select("decision, cleanup_issue")
      .eq("feature_issue", MINE)
      .single();
    expect(data?.decision).toBe("ready");
    expect(data?.cleanup_issue).toBeGreaterThan(90000);
  });
  test("removing a request's feature turns it off for everyone (spec 135 US3.1)", async ({
    page,
  }) => {
    const added = await adminClient()
      .from("toggles")
      .insert({ key: `feature-${MINE}`, title: "Water tracking" });
    if (added.error) throw added.error;
    const ready = await adminClient()
      .from("feature_requests")
      .update({ stage: "ready_to_try" })
      .eq("feature_issue", MINE);
    if (ready.error) throw ready.error;

    await page.goto("/settings/feature-requests");
    const card = page.getByRole("article", {
      name: "See how much water I drink",
      exact: true,
    });
    await card.getByRole("button", { name: "Remove it" }).click();
    await page
      .getByRole("dialog", { name: "Remove it for everyone?" })
      .getByRole("button", { name: "Remove the feature" })
      .click();

    await expect(card).toContainText("Removed");
    await expect(card.getByRole("button", { name: "Remove it" })).toHaveCount(
      0,
    );
    await expect(card.getByRole("switch", { name: "Try it" })).toHaveCount(0);

    const toggle = await adminClient()
      .from("toggles")
      .select("state")
      .eq("key", `feature-${MINE}`)
      .single();
    expect(toggle.data?.state).toBe("removed");
    const { data } = await adminClient()
      .from("feature_requests")
      .select("decision, cleanup_issue")
      .eq("feature_issue", MINE)
      .single();
    expect(data?.decision).toBe("remove");
    expect(data?.cleanup_issue).toBeGreaterThan(90000);
  });
});
