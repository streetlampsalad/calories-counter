"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { sendBugReport } from "./actions";
import type { BugReportInput } from "./domain";

export const bugReportKeys = {
  all: ["bug-reports"] as const,
  sentToday: () => [...bugReportKeys.all, "sent-today"] as const,
};

const DAY_MS = 24 * 60 * 60 * 1000;

// How many Bug reports the signed-in User sent in the last 24 hours, for the limit message
// (RLS limits the count to their own).
export function useSentToday() {
  return useQuery({
    queryKey: bugReportKeys.sentToday(),
    queryFn: async (): Promise<number> => {
      const since = new Date(Date.now() - DAY_MS).toISOString();
      const { count, error } = await createClient()
        .from("bug_reports")
        .select("id", { count: "exact", head: true })
        .gt("created_at", since);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export const MESSAGES = {
  limit:
    "You can send 5 bug reports a day, and you've sent 5. Try again later.",
  unavailable:
    "Couldn't send your report. Check your connection and try again.",
} as const;

// Not optimistic: nothing shows as sent until GitHub has the Issue.
export function useSendBugReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BugReportInput) => {
      let result: Awaited<ReturnType<typeof sendBugReport>>;
      try {
        result = await sendBugReport(input);
      } catch {
        throw new Error(MESSAGES.unavailable);
      }
      if (!result.ok)
        throw new Error(
          result.code === "limit" ? MESSAGES.limit : MESSAGES.unavailable,
        );
      return { issue: result.issue, url: result.url };
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: bugReportKeys.all }),
  });
}
