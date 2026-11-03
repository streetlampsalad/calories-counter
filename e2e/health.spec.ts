import { expect, test } from "@playwright/test";

test("GET /api/health reports ok and a commit", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(typeof body.commit).toBe("string");
  expect(body.commit.length).toBeGreaterThan(0);
});

test("GET /api/health is never cached", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.headers()["cache-control"] ?? "").not.toMatch(
    /s-maxage|max-age=[1-9]/,
  );
});
