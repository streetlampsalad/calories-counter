"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { NutritionTip } from "./tips-handler";
import { keptTipsSchema } from "./tips-schema";

export const nutritionTipKeys = {
  all: ["nutrition-tips"] as const,
  week: (from: string) => [...nutritionTipKeys.all, "week", from] as const,
};

// The set kept for a week, or null for none. Read with the User's own
// client (RLS applies). A row that does not parse counts as no tips.
export function useKeptTips(weekStart: string) {
  return useQuery({
    queryKey: nutritionTipKeys.week(weekStart),
    queryFn: async (): Promise<NutritionTip[] | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("nutrition_tips")
        .select("tips, created_at")
        .eq("week_start", weekStart)
        .maybeSingle();
      if (error) throw error;
      const parsed = keptTipsSchema.safeParse(data?.tips);
      return parsed.success ? parsed.data : null;
    },
  });
}

// Why asking for tips failed, as the route's code, or "network" when it never answered.
export class TipsError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "TipsError";
  }
}

// Asks the server for last week's Nutrition tips. Never retried: every try counts against the day.
export function useGetTips(weekStart: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: nutritionTipKeys.week(weekStart),
    retry: false,
    // The route keeps the set, so what is shown now is what a reload will show.
    onSuccess: (tips) =>
      queryClient.setQueryData(nutritionTipKeys.week(weekStart), tips),
    mutationFn: async (): Promise<NutritionTip[]> => {
      let response: Response;
      try {
        response = await fetch("/api/nutrition-tips", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ weekStart }),
        });
      } catch {
        throw new TipsError("network");
      }
      const body = (await response.json().catch(() => null)) as {
        code?: string;
        tips?: NutritionTip[];
      } | null;
      if (!response.ok || !body?.tips) {
        throw new TipsError(body?.code ?? "tips_failed");
      }
      return body.tips;
    },
  });
}
