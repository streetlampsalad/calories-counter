import { expect, test } from "@playwright/test";
import { authFile } from "./support/auth";

const signedOut = { storageState: { cookies: [], origins: [] } };

test.describe("signed out", () => {
  test.use(signedOut);

  test("an app route redirects to sign-in, remembering the destination", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/sign-in\?next=%2F$/);
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
  });

  test("sign-in offers Google only", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.getByRole("button")).toHaveCount(1);
    await expect(page.getByRole("textbox")).toHaveCount(0);
  });

  test("sign-in fits a phone screen without sideways scrolling", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);
  });

  test("the invite-only rejection explains who to ask", async ({ page }) => {
    await page.goto("/sign-in?error=not_allowed&email=stranger%40gmail.com");

    // Next.js injects its own empty role="alert" route announcer, so match the text instead.
    await expect(
      page.getByText(
        "This app is invite-only. Ask the owner to add stranger@gmail.com.",
      ),
    ).toBeVisible();
  });

  test("the health check stays reachable", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
  });
});

test.describe("signed in", () => {
  test.use({ storageState: authFile("ada") });

  test("sign-in sends a signed-in User home", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page).toHaveURL("/");
  });
});
