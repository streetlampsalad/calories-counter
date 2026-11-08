import { createClient } from "@/lib/supabase/server";

// Whether a Toggle is on for the User making this request (ADR 0008), for Server Components and
// route handlers. Off whenever the database cannot say, so an error never shows half a feature.
export async function isToggleOn(key: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("toggle_is_on", { key });
    return !error && data === true;
  } catch {
    return false;
  }
}
