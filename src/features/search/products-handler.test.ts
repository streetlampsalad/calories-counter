import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearProductCache,
  handleProducts,
  OFF_USER_AGENT,
} from "./products-handler";

const recorded = JSON.parse(
  readFileSync(
    join(process.cwd(), "src/features/search/fixtures/off-tim-tam.json"),
    "utf8",
  ),
);

const fetchOff = vi.fn<typeof fetch>();
const signedIn = () => Promise.resolve("user-1");
const signedOut = () => Promise.resolve(null);
const ask = (
  q: string | null,
  userId: () => Promise<string | null> = signedIn,
  timeoutMs?: number,
) =>
  handleProducts(
    new Request(
      `http://localhost/api/search/products${q === null ? "" : `?q=${encodeURIComponent(q)}`}`,
    ),
    { userId, fetch: fetchOff, timeoutMs },
  );

describe("handleProducts", () => {
  beforeEach(() => {
    clearProductCache();
    fetchOff.mockReset();
    fetchOff.mockImplementation(async () => Response.json(recorded));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("turns away someone who is signed out, without calling Open Food Facts", async () => {
    const response = await ask("tim tam", signedOut);

    expect(response.status).toBe(401);
    expect(fetchOff).not.toHaveBeenCalled();
  });

  it("needs at least two characters", async () => {
    expect((await ask("t")).status).toBe(400);
    expect((await ask(" ")).status).toBe(400);
    expect((await ask(null)).status).toBe(400);
    expect(fetchOff).not.toHaveBeenCalled();
  });

  it("returns the products as Suggestions", async () => {
    const response = await ask("tim tam");

    expect(response.status).toBe(200);
    const { products } = await response.json();
    expect(products).toHaveLength(3);
    expect(products[0]).toMatchObject({
      name: "Tim Tam",
      brand: "Arnott's",
      per100: { calories: 524, unit: "g" },
    });
  });

  it("asks only for Australian products and only the fields it needs", async () => {
    await ask("tim tam");

    const [url, init] = fetchOff.mock.calls[0];
    const asked = new URL(String(url));
    expect(asked.hostname).toBe("world.openfoodfacts.org");
    expect(asked.searchParams.get("search_terms")).toBe("tim tam");
    expect(asked.searchParams.get("tag_0")).toBe("australia");
    expect(asked.searchParams.get("tagtype_0")).toBe("countries");
    expect(asked.searchParams.get("fields")).toBe(
      "code,product_name,brands,serving_size,nutriments",
    );
    expect(asked.searchParams.get("json")).toBe("1");
    expect(Number(asked.searchParams.get("page_size"))).toBeLessThanOrEqual(20);
    expect((init?.headers as Record<string, string>)["User-Agent"]).toBe(
      OFF_USER_AGENT,
    );
  });

  it("identifies itself the way Open Food Facts asks", () => {
    expect(OFF_USER_AGENT).toMatch(/^CaloriesCounter\/1\.0 \(.+\)$/);
  });

  it("gives up when Open Food Facts is too slow, and says the section is unavailable (AC-3)", async () => {
    fetchOff.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("timed out", "TimeoutError")),
          );
        }),
    );
    const response = await ask("tim tam", signedIn, 20);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "unavailable" });
  });

  it("says unavailable when Open Food Facts errors or is unreachable", async () => {
    fetchOff.mockResolvedValue(new Response("busy", { status: 503 }));
    expect((await ask("tim tam")).status).toBe(503);

    clearProductCache();
    fetchOff.mockRejectedValue(new TypeError("network"));
    const response = await ask("tim tam");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "unavailable" });
  });

  it("says unavailable for a reply that is not JSON", async () => {
    fetchOff.mockResolvedValue(new Response("<html>", { status: 200 }));

    expect((await ask("tim tam")).status).toBe(503);
  });

  it("does not keep a failure in the cache", async () => {
    fetchOff.mockResolvedValueOnce(new Response("busy", { status: 503 }));
    await ask("tim tam");

    const second = await ask("tim tam");

    expect(second.status).toBe(200);
    expect(fetchOff).toHaveBeenCalledTimes(2);
  });

  it("answers a repeat search from its cache for an hour, whatever the case or spacing", async () => {
    vi.useFakeTimers();
    await ask("tim tam");
    await ask("  TIM   Tam ");
    expect(fetchOff).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    await ask("tim tam");
    vi.useRealTimers();

    expect(fetchOff).toHaveBeenCalledTimes(2);
  });

  it("lets the browser keep the answer too, privately", async () => {
    const response = await ask("tim tam");

    expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
  });

  it("never leaks the search to another User through the cache", async () => {
    // The cache holds only public product data keyed by the query, so sharing it is safe;
    // what must not be shared is anything about who asked.
    await ask("tim tam");

    expect(JSON.stringify(fetchOff.mock.calls)).not.toContain("user-1");
  });
});

describe("handleProducts: the time limit", () => {
  it("is five seconds", async () => {
    clearProductCache();
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchOk = vi.fn<typeof fetch>(async () => Response.json(recorded));

    await handleProducts(
      new Request("http://localhost/api/search/products?q=tim"),
      {
        userId: signedIn,
        fetch: fetchOk,
      },
    );

    expect(timeout).toHaveBeenCalledWith(5000);
    timeout.mockRestore();
  });
});
