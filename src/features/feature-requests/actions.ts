"use server";

import { isToggleOn } from "@/features/toggles/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { FEATURE_REQUESTS_TOGGLE } from "./domain";
import { createFeatureIssues } from "./feature-issues";
import { type SubmitResult, submitFeatureRequest as submit } from "./submit";

// Reachable by a direct POST, so it checks the Toggle and the session itself (spec 124). Rows are
// written with the service role because Users may only read their requests.
export async function submitFeatureRequest(
  input: unknown,
): Promise<SubmitResult> {
  const supabase = await createClient();
  const admin = createAdminClient();

  return submit(input, {
    toggleOn: () => isToggleOn(FEATURE_REQUESTS_TOGGLE),
    userId: async () => {
      const { data } = await supabase.auth.getClaims();
      return data?.claims.sub ?? null;
    },
    insert: async (row) => {
      const { data, error } = await admin
        .from("feature_requests")
        .insert(row)
        .select("id")
        .single();
      if (error?.code === "23514" && error.message === "feature_request_limit")
        return "limit";
      if (error) throw error;
      return data;
    },
    setIssue: async (id, number) => {
      const { error } = await admin
        .from("feature_requests")
        .update({ feature_issue: number })
        .eq("id", id);
      if (error) throw error;
    },
    remove: async (id) => {
      const { error } = await admin
        .from("feature_requests")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    issues: createFeatureIssues(),
    log: (message, error) => console.error(message, error),
  });
}
