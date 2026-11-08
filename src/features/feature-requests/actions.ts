"use server";

import { isToggleOn } from "@/features/toggles/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { type DecideResult, decide } from "./decide";
import { type Decision, FEATURE_REQUESTS_TOGGLE, type Stage } from "./domain";
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
            previous: {
              stage: round.previous_stage as Stage,
              stageChangedAt: round.previous_stage_changed_at,
              latestComment: round.previous_latest_comment,
              readyNote: round.previous_ready_note,
            },
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
    undoRound: async (roundId, before) => {
      const { error } = await admin.rpc("undo_feature_request_round", {
        round_id: roundId,
        stage: before.stage,
        stage_changed_at: before.stageChangedAt,
        latest_comment: before.latestComment ?? undefined,
        ready_note: before.readyNote ?? undefined,
      });
      if (error) throw error;
    },
    issues: createFeatureIssues(),
    log: (message, error) => console.error(message, error),
  });
}

// It's ready: the clean-up Chore, then the Toggle Live for everyone (spec 135 US2).
export async function markReady(input: unknown): Promise<DecideResult> {
  return decideOn(input, "ready");
}

// Remove it: the feature-removal Chore, then the Toggle Removed for everyone (spec 135 US3).
export async function removeFeature(input: unknown): Promise<DecideResult> {
  return decideOn(input, "remove");
}

async function decideOn(
  input: unknown,
  decision: Decision,
): Promise<DecideResult> {
  const supabase = await createClient();
  const admin = createAdminClient();

  return decide(input, decision, {
    toggleOn: () => isToggleOn(FEATURE_REQUESTS_TOGGLE),
    userId: async () => {
      const { data } = await supabase.auth.getClaims();
      return data?.claims.sub ?? null;
    },
    find: async (id, userId) => {
      const { data, error } = await admin
        .from("feature_requests")
        .select("feature_issue")
        .eq("id", id)
        .eq("user_id", userId)
        .is("withdrawn_at", null)
        .is("decision", null)
        .not("first_ready_at", "is", null)
        .in("stage", ["ready_to_try", "not_going_ahead"])
        .maybeSingle();
      if (error) throw error;
      if (!data?.feature_issue) return null;
      const toggle = await admin
        .from("toggles")
        .select("state")
        .eq("key", `feature-${data.feature_issue}`)
        .maybeSingle();
      if (toggle.error) throw toggle.error;
      return toggle.data?.state === "testing"
        ? { featureIssue: data.feature_issue }
        : null;
    },
    record: async (id, userId, decision, cleanupIssue) => {
      const { data, error } = await admin.rpc("decide_feature_request", {
        request_id: id,
        requester_id: userId,
        decision,
        cleanup_issue: cleanupIssue,
      });
      if (error) throw error;
      return data;
    },
    recordedChore: async (id) => {
      const { data, error } = await admin
        .from("feature_requests")
        .select("cleanup_issue")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data.cleanup_issue;
    },
    issues: createFeatureIssues(),
    log: (message, error) => console.error(message, error),
  });
}
