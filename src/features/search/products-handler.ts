import { MIN_QUERY } from "./limits";
import { mapOffProducts } from "./off";
import type { Suggestion } from "./suggestions";

// Open Food Facts asks every app to say who it is.
export const OFF_USER_AGENT =
  "CaloriesCounter/1.0 (https://github.com/streetlampsalad/calories-counter)";
const OFF_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const TIMEOUT_MS = 5000;
const CACHE_MS = 60 * 60 * 1000;
const CACHE_LIMIT = 200;
const PAGE_SIZE = 15;

type Deps = {
  /** The signed-in User's id, or null. */
  userId: () => Promise<string | null>;
  fetch: typeof fetch;
  /** How long to wait for Open Food Facts. Five seconds unless a test says otherwise. */
  timeoutMs?: number;
};

// Product data is public and the same for everyone, so one answer can serve any User. Kept per
// server instance, which is plenty to stay inside Open Food Facts' rate limits for a few people.
const cache = new Map<string, { at: number; products: Suggestion[] }>();
export const clearProductCache = () => cache.clear();

const reply = (status: number, body: unknown, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers });

const normalise = (q: string) => q.trim().replace(/\s+/g, " ").toLowerCase();

async function lookup(
  q: string,
  doFetch: typeof fetch,
  timeoutMs: number,
): Promise<Suggestion[]> {
  const key = normalise(q);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.products;

  const url = new URL(OFF_URL);
  url.search = new URLSearchParams({
    search_terms: q,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(PAGE_SIZE),
    tagtype_0: "countries",
    tag_contains_0: "contains",
    tag_0: "australia",
    fields: "code,product_name,brands,serving_size,nutriments",
  }).toString();

  const response = await doFetch(url, {
    headers: { "User-Agent": OFF_USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok)
    throw new Error(`Open Food Facts answered ${response.status}`);
  const products = mapOffProducts(await response.json());

  if (cache.size >= CACHE_LIMIT)
    cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), products });
  return products;
}

// Packaged products matching a search, from Open Food Facts. A slow or failing Open Food Facts
// becomes "unavailable" so the rest of the search carries on without it.
export async function handleProducts(
  request: Request,
  { userId, fetch: doFetch, timeoutMs = TIMEOUT_MS }: Deps,
): Promise<Response> {
  if ((await userId()) === null) return reply(401, { code: "unauthorized" });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < MIN_QUERY) return reply(400, { code: "query_too_short" });

  try {
    const products = await lookup(q, doFetch, timeoutMs);
    return reply(
      200,
      { products },
      { "Cache-Control": "private, max-age=3600" },
    );
  } catch (error) {
    console.error(
      `Open Food Facts search failed: ${error instanceof Error ? error.name : "unknown error"}`,
    );
    return reply(503, { code: "unavailable" });
  }
}
