import { expect, test } from "@playwright/test";

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
