"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { summaryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_SETTINGS, type Settings, toSettings } from "./domain";

export const settingsKeys = {
  all: ["settings"] as const,
  current: () => [...settingsKeys.all, "current"] as const,
};

// The signed-in User's settings, or the defaults if they have never saved any.
export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.current(),
    queryFn: async (): Promise<Settings> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_settings")
        .select("daily_goal_calories, week_starts_on")
        .maybeSingle();
      if (error) throw error;
      return toSettings(data);
    },
  });
}

// Saves only the fields given, so changing one setting never overwrites another.
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const supabase = createClient();
      const row: {
        daily_goal_calories?: number | null;
        week_starts_on?: number;
      } = {};
      if (patch.dailyGoal !== undefined)
        row.daily_goal_calories = patch.dailyGoal;
      if (patch.weekStartsOn !== undefined)
        row.week_starts_on = patch.weekStartsOn;
      const { error } = await supabase
        .from("user_settings")
        .upsert(row, { onConflict: "user_id" });
      if (error) {
        throw new Error(
          "Couldn't save your settings. Check your connection and try again.",
        );
      }
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: settingsKeys.all });
      const previous = queryClient.getQueryData<Settings>(
        settingsKeys.current(),
      );
      queryClient.setQueryData<Settings>(settingsKeys.current(), (current) => ({
        ...(current ?? DEFAULT_SETTINGS),
        ...patch,
      }));
      return { previous };
    },
    onError: (_error, _patch, context) =>
      queryClient.setQueryData(settingsKeys.current(), context?.previous),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
        // Summaries compare with the Goal and start their weeks on this day.
        queryClient.invalidateQueries({ queryKey: summaryKeys.all }),
      ]),
  });
}
