import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./support/auth";
import { userClient } from "./support/db";
import { hydrated } from "./support/ready";
import { seedFood, unique } from "./support/seed";

// Waits for hydration, so a chosen file reaches the screen's handler (see support/ready.ts).
async function openImport(page: Page) {
  await page.goto("/foods/import");
  await hydrated(page.getByLabel("Photo from camera"));
}

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
  await openImport(page);
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
  await openImport(page);

  await page.getByRole("button", { name: "Copy prompt" }).click();

  await expect(page.getByText(/copy it by hand/)).toBeVisible();
  const selected = await page.evaluate(
    () => window.getSelection()?.toString() ?? "",
  );
  expect(selected).toContain("Only include foods that are actually written");
});

test("the screen leads back to the Food List", async ({ page }) => {
  await openImport(page);

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
  await openImport(page);

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
  await openImport(page);

  await pasteResult(page, "name,portion,kilojoules\nChocolate,1 bar,1000");

  const row = reviewRows(page).first();
  await expect(row.getByLabel("Calories")).toHaveValue("239");
  await expect(row).toContainText("(from 1,000 kJ)");
});

test("text that is neither CSV nor JSON is turned away with the formats spelled out", async ({
  page,
}) => {
  await openImport(page);

  await pasteResult(page, "Remember to buy milk");

  await expect(sourceAlert(page)).toContainText("CSV or JSON");
  await expect(sourceAlert(page)).toContainText("name,portion,calories");
});

test("a chosen file is read the same way", async ({ page }) => {
  await openImport(page);

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
  await openImport(page);

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
  await openImport(page);
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
  await openImport(page);
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
  await openImport(page);
  await expect(page.getByLabel("Paste the result")).toBeVisible();
});

test("the bottom navigation asks before leaving too", async ({ page }) => {
  await openImport(page);
  await pasteResult(page, CSV);

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Today" })
    .click();

  await expect(page.getByRole("dialog")).toContainText("haven't been saved");
  await expect(page).toHaveURL("/foods/import");
});

test("a row already in the Food List is flagged, skipped by default, and can update the Food", async ({
  page,
}) => {
  const bea = await userClient("bea");
  const name = unique("Dup banana");
  await seedFood(bea, { name, portion: "1 medium", calories: 90 });
  await openImport(page);

  await pasteResult(
    page,
    `name,portion,calories\n${name.toUpperCase()}, 1 Medium ,105\nFresh ${name},1 piece,50`,
  );

  const duplicate = reviewRows(page).nth(0);
  await expect(duplicate).toContainText("Already in your list (90 kcal)");
  await expect(duplicate.getByRole("radio", { name: "Skip" })).toBeChecked();
  await expect(duplicate).toContainText("Skipped, already in your list");
  await expect(reviewRows(page).nth(1)).not.toContainText(
    "Already in your list",
  );
  await expect(
    page.getByText("1 of 2 rows will be saved, 1 already in your list"),
  ).toBeVisible();

  await duplicate.getByText("Update existing").click();

  await expect(duplicate).toContainText("Will update your existing food");
  await expect(duplicate).toContainText("Past days will use the new calories");
  await expect(page.getByText("2 of 2 rows will be saved")).toBeVisible();
});

test("identical rows in one import are merged into one", async ({ page }) => {
  await openImport(page);

  await pasteResult(
    page,
    "name,portion,calories\nMerge me,1 slice,100\nmerge me,1 slice,100\nMerge me,1 slice,120",
  );

  await expect(reviewRows(page)).toHaveCount(1);
  await expect(reviewRows(page).first()).toContainText(
    "Merged with 2 identical rows",
  );
  await expect(reviewRows(page).first()).toContainText(
    "Another row said 120 kcal",
  );
});

test("saving adds the new foods, updates the chosen duplicate and returns to the Food List", async ({
  page,
}) => {
  const bea = await userClient("bea");
  const dup = unique("Dup rice");
  const fresh = unique("Fresh pie");
  const fixme = unique("Fixme soup");
  await seedFood(bea, { name: dup, portion: "100 g", calories: 90 });
  await openImport(page);
  await pasteResult(
    page,
    `name,portion,calories\n${fresh},1 slice,300\n${fixme},1 bowl,\n${dup},100 g,130`,
  );
  await reviewRows(page).nth(1).getByLabel("Calories").fill("70");
  await reviewRows(page).nth(2).getByText("Update existing").click();
  await expect(
    page.getByRole("button", { name: "Save 3 foods" }),
  ).toBeEnabled();

  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/rpc/import_foods") && response.status() < 300,
  );
  await page.getByRole("button", { name: "Save 3 foods" }).click();
  await saved;

  await expect(page).toHaveURL("/foods");
  await expect(page.getByText("Added 2, updated 1")).toBeVisible();
  const row = (name: string) =>
    page.getByRole("button", { name: new RegExp(`^Edit ${name},`) });
  await expect(row(fresh)).toContainText("1 slice · 300 kcal");
  await expect(row(fixme)).toContainText("1 bowl · 70 kcal");
  await expect(row(dup)).toContainText("100 g · 130 kcal");
  const { data } = await bea.from("foods").select("calories").eq("name", dup);
  expect(data).toEqual([{ calories: 130 }]);

  // The review is gone: coming back starts clean.
  await openImport(page);
  await expect(page.getByLabel("Paste the result")).toBeVisible();
});

test("when saving fails nothing is saved and every edit is kept for a retry", async ({
  page,
}) => {
  const bea = await userClient("bea");
  const name = unique("Retry toast");
  await openImport(page);
  await pasteResult(page, `name,portion,calories\n${name},1 slice,`);
  await reviewRows(page).first().getByLabel("Calories").fill("120");
  await page.route("**/rpc/import_foods", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "XX000", message: "boom" }),
    }),
  );

  await page.getByRole("button", { name: "Save 1 food" }).click();

  await expect(
    page.getByText("Couldn't save: boom. Nothing was saved.").first(),
  ).toBeVisible();
  await expect(page).toHaveURL("/foods/import");
  await expect(reviewRows(page).first().getByLabel("Calories")).toHaveValue(
    "120",
  );
  const none = await bea.from("foods").select("id").eq("name", name);
  expect(none.data).toEqual([]);

  await page.unroute("**/rpc/import_foods");
  await page.getByRole("button", { name: "Save 1 food" }).click();

  await expect(page).toHaveURL("/foods");
  await expect(page.getByText("Added 1")).toBeVisible();
  const saved = await bea.from("foods").select("calories").eq("name", name);
  expect(saved.data).toEqual([{ calories: 120 }]);
});

// A real picture, bigger than the 1,600 px the app shrinks photos to.
async function bigPhoto(page: Page, width = 3200, height = 2400) {
  const base64 = await page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no canvas");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, w, h);
      context.fillStyle = "#000";
      context.font = "200px sans-serif";
      context.fillText("Toast 110", 200, 600);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    [width, height],
  );
  return {
    name: "notes.png",
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  };
}

// Width and height from a JPEG's start-of-frame marker.
function jpegSize(bytes: Buffer) {
  for (let i = 2; i < bytes.length - 9; i += 1) {
    if (bytes[i] === 0xff && [0xc0, 0xc1, 0xc2].includes(bytes[i + 1])) {
      return {
        height: bytes.readUInt16BE(i + 5),
        width: bytes.readUInt16BE(i + 7),
      };
    }
  }
  throw new Error("not a JPEG");
}

test("a scanned photo is shrunk on the device, then read into Import Review", async ({
  page,
}) => {
  await openImport(page);
  const photo = await bigPhoto(page);
  await page.route("**/api/import/photo", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });
  const upload = page.waitForRequest("**/api/import/photo");

  await page.getByLabel("Photo from camera").setInputFiles(photo);

  await expect(page.getByText("Reading your notes…")).toBeVisible();
  const request = await upload;
  const sent = request.postDataBuffer();
  expect(request.headers()["content-type"]).toBe("image/jpeg");
  if (!sent) throw new Error("no body");
  expect([sent[0], sent[1]]).toEqual([0xff, 0xd8]);
  const size = jpegSize(sent);
  expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(1600);
  expect(size.width / size.height).toBeCloseTo(3200 / 2400, 1);

  await expect(reviewRows(page)).toHaveCount(3);
  await expect(reviewRows(page).nth(0).getByLabel("Name")).toHaveValue(
    "Vegemite toast",
  );
  await expect(reviewRows(page).nth(2)).toContainText("(from 1,000 kJ)");
});

test("another photo adds its rows to the same import", async ({ page }) => {
  await openImport(page);
  const photo = await bigPhoto(page, 800, 600);
  await page.getByLabel("Photo from camera").setInputFiles(photo);
  await expect(reviewRows(page)).toHaveCount(3);
  await page.route("**/api/import/photo", (route) =>
    route.fulfill({
      json: {
        rows: [
          {
            name: "Second page rice",
            portion: "100 g",
            calories: "130",
            kilojoules: "",
          },
        ],
      },
    }),
  );

  await page.getByLabel("Photo from gallery").setInputFiles(photo);

  await expect(reviewRows(page)).toHaveCount(4);
  await expect(reviewRows(page).nth(3).getByLabel("Name")).toHaveValue(
    "Second page rice",
  );
  await expect(
    page.getByRole("button", { name: "Save 4 foods" }),
  ).toBeEnabled();
});

test("a photo with no foods says so and can be retaken", async ({ page }) => {
  await openImport(page);
  const photo = await bigPhoto(page, 800, 600);
  await page.route("**/api/import/photo", (route) =>
    route.fulfill({ json: { rows: [] } }),
  );

  await page.getByLabel("Photo from camera").setInputFiles(photo);

  await expect(
    page.getByRole("region", { name: "Scan your notes" }).getByRole("alert"),
  ).toContainText("Couldn't find any foods in that photo");
  await expect(
    page.getByRole("button", { name: "Take a photo" }),
  ).toBeEnabled();
});

test("when the photo reader is unavailable the User is offered an AI app instead", async ({
  page,
}) => {
  await openImport(page);
  const photo = await bigPhoto(page, 800, 600);
  await page.route("**/api/import/photo", (route) =>
    route.fulfill({ status: 503, json: { code: "reader_unavailable" } }),
  );

  await page.getByLabel("Photo from camera").setInputFiles(photo);
  const alert = page
    .getByRole("region", { name: "Scan your notes" })
    .getByRole("alert");
  await expect(alert).toContainText("isn't available right now");
  await alert.getByRole("button", { name: "Use an AI app instead" }).click();

  await expect(alert).toHaveCount(0);
  await expect(page.getByTestId("prompt")).toBeInViewport();
});

test("Scan notes in the Add food sheet reads the photo on the import screen", async ({
  page,
}) => {
  await page.goto("/foods");
  const photo = await bigPhoto(page, 800, 600);

  await page.getByRole("button", { name: "Add food" }).first().click();
  await hydrated(page.getByLabel(/Scan notes/));
  await page.getByLabel(/Scan notes/).setInputFiles(photo);

  await expect(page).toHaveURL("/foods/import");
  await expect(reviewRows(page)).toHaveCount(3);
});
