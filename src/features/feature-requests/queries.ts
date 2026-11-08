"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { submitFeatureRequest, withdrawFeatureRequest } from "./actions";
import type { FeatureRequestInput, Stage } from "./domain";

export type FeatureRequest = {
  id: string;
  goal: string;
  stage: Stage;
  featureIssue: number | null;
  latestComment: string | null;
  readyNote: string | null;
  withdrawnAt: string | null;
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

// The signed-in User's own Feature Requests, newest first.
export function useMyFeatureRequests() {
  return useQuery({
    queryKey: featureRequestKeys.mine(),
    queryFn: async (): Promise<FeatureRequest[]> => {
      const { data, error } = await createClient()
        .from("feature_requests")
        .select(
          "id, goal, stage, feature_issue, latest_comment, ready_note, withdrawn_at, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        goal: row.goal,
        stage: row.stage as Stage,
        featureIssue: row.feature_issue,
        latestComment: row.latest_comment,
        readyNote: row.ready_note,
        withdrawnAt: row.withdrawn_at,
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
