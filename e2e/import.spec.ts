import { expect, test } from "@playwright/test";
import { authFile } from "./support/auth";

// The import screen only reads and copies, so it can share a User with other specs.
test.use({ storageState: authFile("bea") });

test("Add food leads to the import screen with its three steps and the prompt", async ({
  page,
}) => {
  await page.goto("/foods");

  await page.getByRole("button", { name: "Add food" }).first().click();
  await page.getByRole("link", { name: /Import from notes/ }).click();

  await expect(page).toHaveURL("/foods/import");
  await expect(
    page.getByRole("heading", { name: "Import from notes", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(3);
  await expect(page.getByTestId("prompt")).toContainText(
    "You are converting a photo of my handwritten food notes",
  );
  await expect(page.getByTestId("prompt")).toContainText(
    "The first line must be exactly: name,portion,calories",
  );
});

test("Copy prompt puts the exact prompt on the clipboard", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/foods/import");
  const shown = (await page.getByTestId("prompt").textContent()) ?? "";

  await page.getByRole("button", { name: "Copy prompt" }).click();

  await expect(page.getByText("Prompt copied")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  // Windows clipboards hand back CRLF line endings.
  expect(copied.split("\r\n").join("\n")).toBe(shown);
});

test("when copying is refused the prompt is selected for copying by hand", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
      configurable: true,
    });
  });
  await page.goto("/foods/import");

  await page.getByRole("button", { name: "Copy prompt" }).click();

  await expect(page.getByText(/copy it by hand/)).toBeVisible();
  const selected = await page.evaluate(
    () => window.getSelection()?.toString() ?? "",
  );
  expect(selected).toContain("Only include foods that are actually written");
});

test("the screen leads back to the Food List", async ({ page }) => {
  await page.goto("/foods/import");

  await page.getByRole("link", { name: /Foods/ }).first().click();

  await expect(page).toHaveURL("/foods");
});
