import { expect, test } from "@playwright/test";

// The scheduler's route (spec 016, ADR 0005) is public to the proxy, so the shared secret is its
// only lock. No signed-in session may open it, and a browser tab never sends a Reminder.
test.describe("POST /api/reminders/send", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("refuses a call with no secret", async ({ request }) => {
    const response = await request.post("/api/reminders/send");

    expect(response.status()).toBe(401);
  });

  test("refuses a call with the wrong secret", async ({ request }) => {
    const response = await request.post("/api/reminders/send", {
      headers: { "x-scheduler-secret": "not-the-secret" },
    });

    expect(response.status()).toBe(401);
  });

  test("with the secret and nobody due, answers 200 and sends nothing", async ({
    request,
  }) => {
    // Local env sets REMINDER_SECRET (scripts/local-env.mjs); production sets its own.
    const secret = process.env.REMINDER_SECRET;
    test.skip(!secret, "REMINDER_SECRET is not set; run pnpm env:local");

    const response = await request.post("/api/reminders/send", {
      headers: { "x-scheduler-secret": secret ?? "" },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.sent).toBe(0);
    expect(response.headers()["cache-control"]).toBe("no-store");
  });

  test("cannot be opened with GET", async ({ request }) => {
    const response = await request.get("/api/reminders/send");

    expect(response.status()).toBe(405);
  });
});
