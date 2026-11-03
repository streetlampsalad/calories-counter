import { expect, type Page, test } from "@playwright/test";
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

const CSV = [
  "name,portion,calories",
  "Banana,1 medium,105",
  "Mystery,1 serve,",
  "Chocolate,1 bar,",
].join("\n");

async function pasteResult(page: Page, text: string) {
  await page.getByLabel("Paste the result").fill(text);
  await page.getByRole("button", { name: "Review pasted result" }).click();
}
// Scoped, because Next's route announcer is also an alert.
const sourceAlert = (page: Page) =>
  page
    .getByRole("region", { name: "Bring the result back" })
    .getByRole("alert");
const reviewRows = (page: Page) =>
  page.getByRole("list", { name: "Rows to review" }).getByRole("listitem");

test("a pasted result is reviewed row by row, and a flagged row is fixed inline", async ({
  page,
}) => {
  await page.goto("/foods/import");

  await pasteResult(page, CSV);

  await expect(reviewRows(page)).toHaveCount(3);
  await expect(
    page.getByText("1 of 3 rows will be saved, 2 need fixing"),
  ).toBeVisible();
  const mystery = reviewRows(page).nth(1);
  await expect(mystery).toContainText("Add calories or kilojoules");
  await expect(mystery.getByRole("switch")).not.toBeChecked();
  await expect(mystery.getByRole("switch")).toBeDisabled();

  await mystery.getByLabel("Calories").fill("180");

  await expect(mystery.getByRole("switch")).toBeChecked();
  await expect(mystery).not.toContainText("Add calories or kilojoules");
  await expect(
    page.getByText("2 of 3 rows will be saved, 1 needs fixing"),
  ).toBeVisible();
});

test("kilojoules are converted and the original value is shown", async ({
  page,
}) => {
  await page.goto("/foods/import");

  await pasteResult(page, "name,portion,kilojoules\nChocolate,1 bar,1000");

  const row = reviewRows(page).first();
  await expect(row.getByLabel("Calories")).toHaveValue("239");
  await expect(row).toContainText("(from 1,000 kJ)");
});

test("text that is neither CSV nor JSON is turned away with the formats spelled out", async ({
  page,
}) => {
  await page.goto("/foods/import");

  await pasteResult(page, "Remember to buy milk");

  await expect(sourceAlert(page)).toContainText("CSV or JSON");
  await expect(sourceAlert(page)).toContainText("name,portion,calories");
});

test("a chosen file is read the same way", async ({ page }) => {
  await page.goto("/foods/import");

  await page.getByLabel("CSV or JSON file").setInputFiles({
    name: "foods.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV),
  });

  await expect(reviewRows(page)).toHaveCount(3);
});

test("a file that is not CSV or JSON is rejected before it is read", async ({
  page,
}) => {
  await page.goto("/foods/import");

  await page.getByLabel("CSV or JSON file").setInputFiles({
    name: "notes.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4"),
  });

  await expect(sourceAlert(page)).toContainText("CSV or JSON");
  await expect(reviewRows(page)).toHaveCount(0);
});

test("the rows survive a reload, so switching apps does not lose them", async ({
  page,
}) => {
  await page.goto("/foods/import");
  await pasteResult(page, CSV);
  await reviewRows(page).nth(1).getByLabel("Calories").fill("180");

  await page.reload();

  await expect(reviewRows(page)).toHaveCount(3);
  await expect(reviewRows(page).nth(1).getByLabel("Calories")).toHaveValue(
    "180",
  );
});

test("leaving with unsaved rows asks first, and Discard lets go of them", async ({
  page,
}) => {
  await page.goto("/foods/import");
  await pasteResult(page, CSV);

  await page.getByRole("link", { name: /Foods/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("3 rows haven't been saved");
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(page).toHaveURL("/foods/import");
  await expect(reviewRows(page)).toHaveCount(3);

  await page.getByRole("link", { name: /Foods/ }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard" })
    .click();

  await expect(page).toHaveURL("/foods");
  await page.goto("/foods/import");
  await expect(page.getByLabel("Paste the result")).toBeVisible();
});

test("the bottom navigation asks before leaving too", async ({ page }) => {
  await page.goto("/foods/import");
  await pasteResult(page, CSV);

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Today" })
    .click();

  await expect(page.getByRole("dialog")).toContainText("haven't been saved");
  await expect(page).toHaveURL("/foods/import");
});
