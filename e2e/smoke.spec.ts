import { expect, test } from "@playwright/test";

test("home page renders on a phone without horizontal scroll", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Calories Counter" }),
  ).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
});
