import { createServerClient } from "@supabase/ssr";

// Users created by supabase/seed.sql. Local only: production signs in with Google.
export const TEST_USERS = {
  ada: {
    id: "11111111-1111-1111-1111-111111111111",
    email: "ada@example.test",
  },
  bea: {
    id: "22222222-2222-2222-2222-222222222222",
    email: "bea@example.test",
  },
  // For tests that depend on a User's whole history (Recent, ordering by use): they run in
  // series and reset dan's data first, because anything else touching him would disturb them.
  dan: {
    id: "44444444-4444-4444-4444-444444444444",
    email: "dan@example.test",
  },
  // For tests that change settings (Goal, week start), which every screen reads: they run in
  // series and reset eve's settings first.
  eve: {
    id: "55555555-5555-5555-5555-555555555555",
    email: "eve@example.test",
  },
  // For tests of summaries, whose numbers depend on a whole window of history: they run in
  // series and reset fay's data first.
  fay: {
    id: "66666666-6666-6666-6666-666666666666",
    email: "fay@example.test",
  },
  // For tests of insights, which depend on a whole window of history: they run in series and
  // reset gus's data first.
  gus: {
    id: "77777777-7777-7777-7777-777777777777",
    email: "gus@example.test",
  },
  // For the test that uses up a day's photo reads, so no other test is ever refused.
  ivy: {
    id: "88888888-8888-8888-8888-888888888888",
    email: "ivy@example.test",
  },
  // For the Reminder tests (spec 016), which change settings and push subscriptions: they run in
  // series and reset jo's first.
  jo: {
    id: "99999999-9999-9999-9999-999999999999",
    email: "jo@example.test",
  },
  // For the Calories Burned tests (spec 017), which change settings and a whole Log: they run in
  // series and reset kit's first.
  kit: {
    id: "10101010-1010-1010-1010-101010101010",
    email: "kit@example.test",
  },
  // The Owner (spec 116), for the Toggle tests, which run in series and reset liv's overrides first.
  liv: {
    id: "12121212-1212-1212-1212-121212121212",
    email: "liv@example.test",
  },
  // Always empty: tests must never leave data behind for cleo.
  cleo: {
    id: "33333333-3333-3333-3333-333333333333",
    email: "cleo@example.test",
  },
} as const;
export const TEST_PASSWORD = "password123";

export type TestUserName = keyof typeof TEST_USERS;

export const authFile = (name: TestUserName) => `e2e/.auth/${name}.json`;

type PlaywrightCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Lax";
};

// Signs in with the real Supabase client so the session cookies have exactly the
// shape (name, encoding, chunking) the app's own server client expects.
export async function signInCookies(
  name: TestUserName,
  supabaseUrl: string,
  publishableKey: string,
  host: string,
): Promise<PlaywrightCookie[]> {
  const jar = new Map<string, string>();
  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([n, value]) => ({ name: n, value })),
      setAll: (cookies) => {
        for (const { name: n, value } of cookies) jar.set(n, value);
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: TEST_USERS[name].email,
    password: TEST_PASSWORD,
  });
  if (error) {
    throw new Error(
      `Could not sign in ${name}: ${error.message}. Is local Supabase running and seeded (pnpm db:reset)?`,
    );
  }

  const expires = Math.floor(Date.now() / 1000) + 400 * 24 * 60 * 60;
  return [...jar].map(([n, value]) => ({
    name: n,
    value,
    domain: host,
    path: "/",
    expires,
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  }));
}
