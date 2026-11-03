import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";
import { TEST_PASSWORD, TEST_USERS, type TestUserName } from "./auth";

// A Supabase client signed in as a seeded test User, for arranging data a test needs.
// Row-level security still applies, exactly as it does for the app.
export async function userClient(name: TestUserName) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Supabase env vars are missing. Run: pnpm env:local");

  const client = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: TEST_USERS[name].email,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`Could not sign in ${name}: ${error.message}`);
  return client;
}
