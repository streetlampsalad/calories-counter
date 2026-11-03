import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  authFile,
  signInCookies,
  TEST_USERS,
  type TestUserName,
} from "./support/auth";

// Signs in each seeded User once and saves the browser state, so tests start signed in.
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required for e2e tests. Run: pnpm db:start && pnpm env:local",
    );
  }

  await mkdir("e2e/.auth", { recursive: true });
  for (const name of Object.keys(TEST_USERS) as TestUserName[]) {
    const cookies = await signInCookies(name, url, key, "127.0.0.1");
    await writeFile(
      path.resolve(authFile(name)),
      JSON.stringify({ cookies, origins: [] }, null, 2),
    );
  }
}
