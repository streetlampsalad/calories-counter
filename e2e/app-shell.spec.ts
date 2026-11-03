import { expect, test } from "@playwright/test";
import { signInCookies } from "./support/auth";

test("bottom navigation is fixed to the bottom with phone-sized tap targets", async ({
  page,
}) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();

  const viewport = page.viewportSize();
  const box = await nav.boundingBox();
  expect(box && viewport && Math.round(box.y + box.height)).toBe(
    viewport?.height,
  );

  for (const name of ["Today", "Foods", "Settings"]) {
    const link = await nav.getByRole("link", { name }).boundingBox();
    expect(link?.height, `${name} tab height`).toBeGreaterThanOrEqual(56);
  }
});

test("the shell fits a phone without sideways scrolling", async ({ page }) => {
  for (const path of ["/", "/settings"]) {
    await page.goto(path);
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows, path).toBe(false);
  }
});

test("tabs navigate between Today and Settings", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByRole("link", { name: "Today" }).click();
  await expect(page).toHaveURL("/");
});

test("Settings shows who is signed in", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByText("ada@example.test")).toBeVisible();
});

test("Sign out ends the session and returns to sign-in", async ({
  page,
  context,
}) => {
  // A fresh session, so signing out cannot disturb the shared stored one.
  await context.clearCookies();
  await context.addCookies(
    await signInCookies(
      "bea",
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      "127.0.0.1",
    ),
  );
  await page.goto("/settings");
  await expect(page.getByText("bea@example.test")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in\?next=%2F$/);
});
