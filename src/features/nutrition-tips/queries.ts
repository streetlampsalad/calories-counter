"use client";

import { useMutation } from "@tanstack/react-query";
import type { NutritionTip } from "./tips-handler";

export const nutritionTipKeys = {
  all: ["nutrition-tips"] as const,
  week: (from: string) => [...nutritionTipKeys.all, "week", from] as const,
};

// Why asking for tips failed, as the route's code, or "network" when it never answered.
export class TipsError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "TipsError";
  }
}

// Asks the server for last week's Nutrition tips. Never retried: every try counts against the day.
export function useGetTips(weekStart: string) {
  return useMutation({
    mutationKey: nutritionTipKeys.week(weekStart),
    retry: false,
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
