"use client";

import { useQuery } from "@tanstack/react-query";
import { summaryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import type { DayTotal } from "./summarise";
import type { FoodTotal } from "./top-foods";

// Each logged Day's total in a range, from one database call. Cached per range, and refreshed
// whenever an Entry, a Food or a setting changes (they all invalidate summaryKeys.all).
export function useDailyTotals(range: { from: string; to: string }) {
  return useQuery({
    queryKey: summaryKeys.period(range.from, range.to),
    queryFn: async (): Promise<DayTotal[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("daily_totals", {
        range_from: range.from,
        range_to: range.to,
      });
      if (error) throw error;
      return data.map((row) => ({
        day: row.day,
        calories: row.calories,
        entryCount: Number(row.entry_count),
      }));
    },
  });
}

// Each Food's total over a range, biggest first, from one database call.
export function useFoodTotals(range: { from: string; to: string }) {
  return useQuery({
    queryKey: summaryKeys.foods(range.from, range.to),
    queryFn: async (): Promise<FoodTotal[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("food_totals", {
        range_from: range.from,
        range_to: range.to,
      });
      if (error) throw error;
      return data.map((row) => ({
        foodId: row.food_id,
        name: row.name,
        portion: row.portion,
        archived: row.archived,
        calories: row.calories,
        entryCount: Number(row.entry_count),
      }));
    },
  });
}
