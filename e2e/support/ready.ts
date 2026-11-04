import { expect, type Locator, type Page } from "@playwright/test";

// A page served by Next.js shows its HTML before React has hydrated it. Anything done in that gap
// reaches the browser but no React handler: a swipe changes nothing, a chosen file is never
// uploaded. A fast laptop rarely hits the gap; a busy CI runner does. These wait it out.

// Resolves once React has hydrated the element, so its handlers are attached. React marks every
// element it manages with a "__reactProps$..." key; it is internal, but stable and only read here.
export async function hydrated(locator: Locator) {
  await expect
    .poll(
      () =>
        locator.evaluate((element) =>
          Object.keys(element).some((key) => key.startsWith("__reactProps$")),
        ),
      { message: "React never hydrated this element" },
    )
    .toBe(true);
}

// The Day view renders only in the browser (the server cannot know the User's date), so its
// heading appearing means the page is hydrated and gestures are being listened for.
export async function openDay(page: Page, url = "/") {
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
