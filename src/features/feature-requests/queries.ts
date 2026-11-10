"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toggleKeys } from "@/features/toggles/queries";
import { createClient } from "@/lib/supabase/client";
import {
  giveFeedback,
  markReady,
  removeFeature,
  submitFeatureRequest,
  withdrawFeatureRequest,
} from "./actions";
import {
  type Decision,
  type FeatureRequestInput,
  type FeedbackSet,
  parseSets,
  type Stage,
} from "./domain";

export type FeatureRequest = {
  id: string;
  goal: string;
  stage: Stage;
  featureIssue: number | null;
  latestComment: string | null;
  readyNote: string | null;
  withdrawnAt: string | null;
  firstReadyAt: string | null;
  // The Requester's feedback, oldest first: Round 2 onwards (spec 135).
  rounds: Round[];
  createdAt: string;
};

export type Round = {
  id: string;
  feedback: string;
  // The Round's Feedback sets in the order sent; null for a Round sent before sets (spec 193).
  sets: FeedbackSet[] | null;
  featureIssue: number | null;
  createdAt: string;
};

export const featureRequestKeys = {
  all: ["feature-requests"] as const,
  mine: () => [...featureRequestKeys.all, "mine"] as const,
  others: () => [...featureRequestKeys.all, "others"] as const,
  ahead: (id: string) => [...featureRequestKeys.all, "ahead", id] as const,
};

export type OtherFeatureRequest = {
  id: string;
  goal: string;
  stage: Stage;
  featureIssue: number;
};

// Stored sets that are missing or malformed fall back to the Round's note.
function roundSets(stored: unknown): FeedbackSet[] | null {
  const parsed = parseSets(stored);
  return parsed.ok ? parsed.value : null;
}

// The signed-in User's own Feature Requests, newest first.
export function useMyFeatureRequests() {
  return useQuery({
    queryKey: featureRequestKeys.mine(),
    queryFn: async (): Promise<FeatureRequest[]> => {
      const { data, error } = await createClient()
        .from("feature_requests")
        .select(
          "id, goal, stage, feature_issue, latest_comment, ready_note, withdrawn_at, first_ready_at, created_at, feature_request_rounds (id, feedback, sets, feature_issue, created_at)",
        )
        .order("created_at", { ascending: false })
        .order("created_at", {
          referencedTable: "feature_request_rounds",
          ascending: true,
        });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        goal: row.goal,
        stage: row.stage as Stage,
        featureIssue: row.feature_issue,
        latestComment: row.latest_comment,
        readyNote: row.ready_note,
        withdrawnAt: row.withdrawn_at,
        firstReadyAt: row.first_ready_at,
        rounds: row.feature_request_rounds.map((round) => ({
          id: round.id,
          feedback: round.feedback,
          sets: roundSets(round.sets),
          featureIssue: round.feature_issue,
          createdAt: round.created_at,
        })),
        createdAt: row.created_at,
      }));
    },
  });
}

// Other Users' requests in progress, without who asked (spec 124 US2.4).
export function useOtherFeatureRequests() {
  return useQuery({
    queryKey: featureRequestKeys.others(),
    queryFn: async (): Promise<OtherFeatureRequest[]> => {
      const { data, error } = await createClient().rpc(
        "other_feature_requests",
      );
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        goal: row.goal,
        stage: row.stage as Stage,
        featureIssue: row.feature_issue,
      }));
    },
  });
}

// How many requests are waiting to be triaged ahead of one of the User's own.
export function useFeatureRequestsAhead(id: string, enabled: boolean) {
  return useQuery({
    queryKey: featureRequestKeys.ahead(id),
    enabled,
    queryFn: async (): Promise<number | undefined> => {
      const { data, error } = await createClient().rpc(
        "feature_requests_ahead",
        {
          request_id: id,
        },
      );
      if (error) throw error;
      return data ?? undefined;
    },
  });
}

const MESSAGES = {
  limit:
    "You already have 2 requests being worked on. Try again once one is ready.",
  unavailable:
    "Couldn't send your request. Check your connection and try again.",
} as const;

// Not optimistic: the request only exists once its Feature Issue does.
export function useSubmitFeatureRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: FeatureRequestInput) => {
      let result: Awaited<ReturnType<typeof submitFeatureRequest>>;
      try {
        result = await submitFeatureRequest(input);
      } catch {
        throw new Error(MESSAGES.unavailable);
      }
      if (!result.ok)
        throw new Error(
          result.code === "limit" ? MESSAGES.limit : MESSAGES.unavailable,
        );
      return { id: result.id };
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: featureRequestKeys.all }),
  });
}

// Not optimistic either: Withdrawn shows once its Issues are closed.
export function useWithdrawFeatureRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      let result: Awaited<ReturnType<typeof withdrawFeatureRequest>>;
      try {
        result = await withdrawFeatureRequest({ id });
      } catch {
        result = { ok: false, code: "unavailable" };
      }
      if (!result.ok)
        throw new Error(
          result.code === "not_allowed"
            ? "It can't be withdrawn any more: building has started."
            : "Couldn't withdraw it. Check your connection and try again.",
        );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: featureRequestKeys.all }),
  });
}

// Not optimistic: the card goes back to Submitted once the follow-up Feature Issue exists.
export function useGiveFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; sets: FeedbackSet[] }) => {
      let result: Awaited<ReturnType<typeof giveFeedback>>;
      try {
        result = await giveFeedback(input);
      } catch {
        result = { ok: false, code: "unavailable" };
      }
      if (!result.ok)
        throw new Error(
          result.code === "limit"
            ? "You already have 2 requests being worked on. Try again once one is ready."
            : result.code === "not_allowed"
              ? "Feedback can't be given on this request any more."
              : result.code === "invalid"
                ? "Some of your feedback couldn't be sent as it is. Check each set and try again."
                : "Couldn't send your feedback. Check your connection and try again.",
        );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: featureRequestKeys.all }),
  });
}

// Not optimistic: the Toggle only leaves Testing once its clean-up Chore exists (spec 135 D4).
export function useDecide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; decision: Decision }) => {
      let result: Awaited<ReturnType<typeof markReady>>;
      try {
        result = await (input.decision === "ready" ? markReady : removeFeature)(
          { id: input.id },
        );
      } catch {
        result = { ok: false, code: "unavailable" };
      }
      if (!result.ok)
        throw new Error(
          result.code === "not_allowed"
            ? "It couldn't be done: this feature is no longer being tested."
            : "Couldn't do that. Check your connection and try again.",
        );
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: featureRequestKeys.all }),
        queryClient.invalidateQueries({ queryKey: toggleKeys.all }),
      ]),
  });
}
