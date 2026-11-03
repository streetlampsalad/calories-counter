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
