"use server";

import { isToggleOn } from "@/features/toggles/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { FEATURE_REQUESTS_TOGGLE, type Stage } from "./domain";
import { createFeatureIssues } from "./feature-issues";
import { type FeedbackResult, giveFeedback as feedback } from "./feedback";
import { type SubmitResult, submitFeatureRequest as submit } from "./submit";
import {
  type WithdrawResult,
  withdrawFeatureRequest as withdraw,
} from "./withdraw";

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

// Withdraws one of the caller's own requests before building starts (spec 124 US4).
export async function withdrawFeatureRequest(
  input: unknown,
): Promise<WithdrawResult> {
  const supabase = await createClient();
  const admin = createAdminClient();

  return withdraw(input, {
    toggleOn: () => isToggleOn(FEATURE_REQUESTS_TOGGLE),
    userId: async () => {
      const { data } = await supabase.auth.getClaims();
      return data?.claims.sub ?? null;
    },
    markWithdrawn: async (id, userId) => {
      const { data, error } = await admin
        .from("feature_requests")
        .update({ withdrawn_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
        .is("withdrawn_at", null)
        .is("first_ready_at", null)
        .in("stage", ["submitted", "being_reviewed", "planning"])
        .select("feature_issue, spec_issue")
        .maybeSingle();
      if (error) throw error;
      return data
        ? { featureIssue: data.feature_issue, specIssue: data.spec_issue }
        : null;
    },
    unmarkWithdrawn: async (id) => {
      const { error } = await admin
        .from("feature_requests")
        .update({ withdrawn_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    issues: createFeatureIssues(),
    log: (message, error) => console.error(message, error),
  });
}

// Starts another Round on one of the caller's own requests (spec 135 US1).
export async function giveFeedback(input: unknown): Promise<FeedbackResult> {
  const supabase = await createClient();
  const admin = createAdminClient();

  return feedback(input, {
    toggleOn: () => isToggleOn(FEATURE_REQUESTS_TOGGLE),
    userId: async () => {
      const { data } = await supabase.auth.getClaims();
      return data?.claims.sub ?? null;
    },
    startRound: async (id, userId, text) => {
      const { data, error } = await admin.rpc("start_feature_request_round", {
        request_id: id,
        requester_id: userId,
        feedback: text,
      });
      if (error?.code === "23514" && error.message === "feature_request_limit")
        return "limit";
      if (error) throw error;
      const round = data[0];
      return round
        ? {
            roundId: round.round_id,
            round: round.round_number,
            goal: round.goal,
            featureIssue: round.feature_issue,
            previousStage: round.previous_stage as Stage,
          }
        : null;
    },
    setRoundIssue: async (roundId, number) => {
      const { error } = await admin
        .from("feature_request_rounds")
        .update({ feature_issue: number })
        .eq("id", roundId);
      if (error) throw error;
    },
    undoRound: async (roundId, id, stage) => {
      const removed = await admin
        .from("feature_request_rounds")
        .delete()
        .eq("id", roundId);
      if (removed.error) throw removed.error;
      const { error } = await admin
        .from("feature_requests")
        .update({ stage })
        .eq("id", id);
      if (error) throw error;
    },
    issues: createFeatureIssues(),
    log: (message, error) => console.error(message, error),
  });
}
