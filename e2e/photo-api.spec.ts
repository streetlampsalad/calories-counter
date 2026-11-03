import { expect, test } from "@playwright/test";
import { authFile } from "./support/auth";

// A tiny valid JPEG header is enough: the stand-in reader never looks at the picture.
const PHOTO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the photo endpoint refuses the call with 401, rather than a sign-in page", async ({
    request,
  }) => {
    const response = await request.post("/api/import/photo", {
      headers: { "content-type": "image/jpeg" },
      data: PHOTO,
      maxRedirects: 0,
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ code: "unauthorized" });
  });
});

test.describe("signed in", () => {
  test.use({ storageState: authFile("cleo") });

  test("a photo comes back as rows in the shape Import Review takes", async ({
    request,
  }) => {
    const response = await request.post("/api/import/photo", {
      headers: { "content-type": "image/jpeg" },
      data: PHOTO,
    });

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const { rows } = await response.json();
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        portion: expect.any(String),
        calories: expect.any(String),
        kilojoules: expect.any(String),
      }),
    );
  });

  test("something that is not a photo is turned away", async ({ request }) => {
    const response = await request.post("/api/import/photo", {
      headers: { "content-type": "text/plain" },
      data: "hello",
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ code: "unsupported_type" });
  });
});
