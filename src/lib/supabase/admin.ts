import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

// A client that skips row level security, for the few server jobs that act on every User's rows
// (the Reminder scheduler, ADR 0005). Import it only from route handlers; the secret key must never
// reach the browser, and the build checks the client bundle for its name.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set");

  return createClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    secretKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
