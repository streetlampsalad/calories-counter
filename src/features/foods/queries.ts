"use client";

import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { entryKeys, summaryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { sortFoods, toFood } from "./domain";
import type { Food } from "./types";

// One factory for every Foods cache key, so mutations invalidate the right things.
export const foodKeys = {
  all: ["foods"] as const,
  list: () => [...foodKeys.all, "list"] as const,
  entryCounts: () => [...foodKeys.all, "entry-counts"] as const,
};

async function fetchFoods(): Promise<Food[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .is("archived_at", null);
  if (error) throw error;
  return sortFoods(data.map(toFood));
}

// The whole Food List is loaded once and searched in memory (spec 003).
export function useFoods() {
  return useQuery({ queryKey: foodKeys.list(), queryFn: fetchFoods });
}

// How many past Entries each Food has, keyed by Food id. Only fetched when asked for.
export function useFoodEntryCounts(enabled: boolean) {
  return useQuery({
    queryKey: foodKeys.entryCounts(),
    enabled,
    queryFn: async (): Promise<Record<string, number>> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("food_entry_counts");
      if (error) throw error;
      return Object.fromEntries(
        data.map((row) => [row.food_id, Number(row.entry_count)]),
      );
    },
  });
}

const UNIQUE_VIOLATION = "23505";

type SaveError = { code?: string } | null;

function saveFailure(error: SaveError, food: Food) {
  return error?.code === UNIQUE_VIOLATION
    ? new Error(`You already have ${food.name} (${food.portion})`)
    : new Error(
        `Couldn't save ${food.name}. Check your connection and try again.`,
      );
}

// Optimistic updates: change the cached list now, keep a copy to put back if the save fails.
async function patchList(
  queryClient: QueryClient,
  change: (foods: Food[]) => Food[],
) {
  await queryClient.cancelQueries({ queryKey: foodKeys.list() });
  const previous = queryClient.getQueryData<Food[]>(foodKeys.list());
  queryClient.setQueryData<Food[]>(foodKeys.list(), (current = []) =>
    sortFoods(change(current)),
  );
  return { previous };
}

const restoreList = (
  queryClient: QueryClient,
  context: { previous?: Food[] } | undefined,
) => queryClient.setQueryData(foodKeys.list(), context?.previous);

export function useAddFood() {
  const queryClient = useQueryClient();

  return useMutation({
    // The id is made on the device, so the optimistic row keeps its identity once saved.
    mutationFn: async (food: Food) => {
      const supabase = createClient();
      const { error } = await supabase.from("foods").insert({
        id: food.id,
        name: food.name,
        portion: food.portion,
        calories: food.calories,
      });
      if (error) throw saveFailure(error, food);
    },
    onMutate: (food) => patchList(queryClient, (current) => [...current, food]),
    onError: (_error, _food, context) => restoreList(queryClient, context),
    onSettled: () => queryClient.invalidateQueries({ queryKey: foodKeys.all }),
  });
}

export function useUpdateFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (food: Food) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("foods")
        .update({
          name: food.name,
          portion: food.portion,
          calories: food.calories,
        })
        .eq("id", food.id)
        .select("id");
      // Row-level security hides other Users' Foods by matching no row, not by erroring.
      if (error || !data?.length) throw saveFailure(error, food);
    },
    onMutate: (food) =>
      patchList(queryClient, (current) =>
        current.map((existing) => (existing.id === food.id ? food : existing)),
      ),
    onError: (_error, _food, context) => restoreList(queryClient, context),
    onSettled: () =>
      // A Food's Calories feed every Daily Total, so anything derived from it is stale (ADR 0001).
      Promise.all([
        queryClient.invalidateQueries({ queryKey: foodKeys.all }),
        queryClient.invalidateQueries({ queryKey: entryKeys.all }),
        queryClient.invalidateQueries({ queryKey: summaryKeys.all }),
      ]),
  });
}
