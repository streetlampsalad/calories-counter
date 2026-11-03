import { expect, test } from "@playwright/test";

test("a signed-in User lands on Today, which fits a phone without sideways scrolling", async ({
  page,
}) => {
  await page.goto("/");

  // Not bounced to sign-in, so the stored session is genuinely accepted.
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toHaveCount(0);

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
});
