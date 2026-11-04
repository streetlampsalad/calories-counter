import { expect, type Page, test } from "@playwright/test";

// These test the service worker itself, which the other specs block (playwright.config.ts).
test.use({ serviceWorkers: "allow" });

// PNG header: width and height are the two big-endian numbers after the "IHDR" tag.
function pngSize(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("the page links the manifest", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
});

test("the manifest names the app and opens it standalone (AC-2)", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/manifest\+json|json/);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "Calories Counter",
    short_name: "Calories",
    start_url: "/",
    display: "standalone",
  });
  expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
});

test("the manifest has 192, 512 and maskable 512 icons that really exist at those sizes (AC-2)", async ({
  request,
}) => {
  const { icons } = await (await request.get("/manifest.webmanifest")).json();

  const wanted = [
    { size: 192, purpose: "any" },
    { size: 512, purpose: "any" },
    { size: 512, purpose: "maskable" },
  ];
  for (const { size, purpose } of wanted) {
    const icon = icons.find(
      (candidate: { sizes: string; purpose: string }) =>
        candidate.sizes === `${size}x${size}` && candidate.purpose === purpose,
    );
    expect(icon, `a ${size} px ${purpose} icon`).toBeTruthy();
    const image = await request.get(icon.src);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
    expect(pngSize(await image.body())).toEqual({ width: size, height: size });
  }
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the browser can still fetch the manifest and icons to offer the install", async ({
    request,
  }) => {
    const manifest = await request.get("/manifest.webmanifest", {
      maxRedirects: 0,
    });
    expect(manifest.status()).toBe(200);

    const icon = await request.get("/icons/icon-192.png", { maxRedirects: 0 });
    expect(icon.status()).toBe(200);
  });
});

// The service worker is registered by the production build, which is what these tests run.
async function controlled(page: Page) {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The worker takes over open pages as it activates; wait until this one is under it.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test("the service worker registers in the production build", async ({
  page,
}) => {
  await controlled(page);

  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.getRegistration())?.scope,
  );
  expect(scope).toBe("http://127.0.0.1:3000/");
});

test("the service worker is always fetched fresh", async ({ request }) => {
  const response = await request.get("/sw.js");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/javascript/);
  expect(response.headers()["cache-control"]).toContain("no-cache");
});

test("opening the app with no connection shows the offline screen (AC-4)", async ({
  page,
  context,
}) => {
  await controlled(page);

  await context.setOffline(true);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "You're offline." }),
  ).toBeVisible();
  await expect(page.getByText("Logging needs a connection.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Retry" })).toBeVisible();
});

test("any page opened offline shows it, not the browser's error", async ({
  page,
  context,
}) => {
  await controlled(page);

  await context.setOffline(true);
  await page.goto("/summary");

  await expect(
    page.getByRole("heading", { name: "You're offline." }),
  ).toBeVisible();
});

test("Retry brings the app back once there is a connection", async ({
  page,
  context,
}) => {
  await controlled(page);
  await context.setOffline(true);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Retry" })).toBeVisible();

  await page.getByRole("link", { name: "Retry" }).click();
  await expect(
    page.getByRole("heading", { name: "You're offline." }),
  ).toBeVisible();

  await context.setOffline(false);
  await page.getByRole("link", { name: "Retry" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});

test("the offline screen looks right, with its own styling", async ({
  page,
  context,
}) => {
  await controlled(page);
  await context.setOffline(true);
  await page.goto("/");

  const retry = page.getByRole("link", { name: "Retry" });
  await expect(retry).toBeVisible();
  const box = await retry.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44); // styled, so tappable
});

test("only the offline page and static build files are ever cached (AC-5)", async ({
  page,
}) => {
  await controlled(page);
  // Use the app, so there are plenty of pages, API calls and database requests to not keep.
  for (const path of ["/foods", "/summary", "/settings", "/foods/search"]) {
    await page.goto(path);
    await page.waitForLoadState("load");
  }
  await page.goto("/foods/search");
  await page.getByLabel("Search for a food").fill("banana");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(
    page.getByRole("list", { name: "Australian foods" }),
  ).toBeVisible();
  await page.evaluate(() => fetch("/api/health"));

  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        urls.push(new URL(request.url).pathname);
      }
    }
    return urls;
  });

  expect(cached).toContain("/offline");
  for (const path of cached) {
    expect(
      path === "/offline" || path.startsWith("/_next/static/"),
      `${path} should not be cached`,
    ).toBe(true);
  }
});

test("Chrome finds nothing in the way of installing the app (AC-1)", async ({
  page,
}) => {
  await controlled(page);
  const cdp = await page.context().newCDPSession(page);

  const { installabilityErrors } = await cdp.send(
    "Page.getInstallabilityErrors",
  );

  expect(installabilityErrors).toEqual([]);
});
