"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { summaryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";

export const burnedKeys = {
  all: ["burned"] as const,
  day: (day: string) => [...burnedKeys.all, "day", day] as const,
};

const SAVE_FAILED = "Couldn't save that. Check your connection and try again.";

// The Calories Burned saved for one Day, or null for none. Only asked when the User tracks it.
export function useDayBurned(day: string, enabled: boolean) {
  return useQuery({
    queryKey: burnedKeys.day(day),
    enabled,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await createClient()
        .from("calories_burned")
        .select("calories")
        .eq("day", day)
        .maybeSingle();
      if (error) throw error;
      return data?.calories ?? null;
    },
  });
}

// Saves a Day's figure, or clears it with null. Shows at once and goes back if the server refuses.
export function useSetBurned() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      day,
      calories,
    }: {
      day: string;
      calories: number | null;
    }) => {
      const supabase = createClient();
      const { error } =
        calories === null
          ? await supabase.from("calories_burned").delete().eq("day", day)
          : await supabase
              .from("calories_burned")
              .upsert({ day, calories }, { onConflict: "user_id,day" });
      if (error) throw new Error(SAVE_FAILED);
    },
    onMutate: async ({ day, calories }) => {
      await queryClient.cancelQueries({ queryKey: burnedKeys.day(day) });
      const previous = queryClient.getQueryData<number | null>(
        burnedKeys.day(day),
      );
      queryClient.setQueryData<number | null>(burnedKeys.day(day), calories);
      return { previous };
    },
    onError: (_error, { day }, context) =>
      queryClient.setQueryData(burnedKeys.day(day), context?.previous),
    onSettled: (_data, _error, { day }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: burnedKeys.day(day) }),
        // The Summary's Deficit follows Calories Burned (spec 017 AC-6).
        queryClient.invalidateQueries({ queryKey: summaryKeys.all }),
      ]),
  });
}
