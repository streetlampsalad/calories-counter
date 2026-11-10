"use server";

import { createFeatureIssues } from "@/features/feature-requests/feature-issues";
import { formatVersion } from "@/features/settings/version";
import { isToggleOn } from "@/features/toggles/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TOGGLE_KEY } from "./domain";
import { type SendResult, sendBugReport as send } from "./send";

// Reachable by a direct POST, so it checks the Toggle and the session itself (spec 194 FR-001).
// Rows are written with the service role because Users may only read their Bug reports.
export async function sendBugReport(input: unknown): Promise<SendResult> {
  const supabase = await createClient();
  const admin = createAdminClient();

  return send(input, {
    userId: async () => {
      const { data } = await supabase.auth.getClaims();
      return data?.claims.sub ?? null;
    },
    toggleOn: () => isToggleOn(TOGGLE_KEY),
    insert: async (row) => {
      const { data, error } = await admin
        .from("bug_reports")
        .insert(row)
        .select("id")
        .single();
      if (error?.code === "23514" && error.message === "bug_report_limit")
        return "limit";
      if (error) throw error;
      return data;
    },
    setIssue: async (id, number) => {
      const { error } = await admin
        .from("bug_reports")
        .update({ bug_issue: number })
        .eq("id", id);
      if (error) throw error;
    },
    remove: async (id) => {
      const { error } = await admin.from("bug_reports").delete().eq("id", id);
      if (error) throw error;
    },
    toggles: async () => {
      const { data, error } = await supabase.rpc("my_toggles");
      if (error) throw error;
      return data
        .filter(
          (toggle) =>
            toggle.is_on &&
            (toggle.state === "testing" || toggle.state === "live"),
        )
        .map((toggle) => ({
          key: toggle.key,
          title: toggle.title,
          state: toggle.state as "testing" | "live",
        }));
    },
    version: formatVersion(process.env.COMMIT_SHA),
    issues: createFeatureIssues(),
    log: (message, error) => console.error(message, error),
  });
}
