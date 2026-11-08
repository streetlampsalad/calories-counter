"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { submitFeatureRequest } from "./actions";
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
