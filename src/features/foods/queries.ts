"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { sortFoods, toFood } from "./domain";
import type { Food } from "./types";

// One factory for every Foods cache key, so mutations invalidate the right things.
export const foodKeys = {
  all: ["foods"] as const,
  list: () => [...foodKeys.all, "list"] as const,
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

const UNIQUE_VIOLATION = "23505";

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
      if (error?.code === UNIQUE_VIOLATION) {
        throw new Error(`You already have ${food.name} (${food.portion})`);
      }
      if (error)
        throw new Error(
          `Couldn't save ${food.name}. Check your connection and try again.`,
        );
    },
    onMutate: async (food) => {
      await queryClient.cancelQueries({ queryKey: foodKeys.list() });
      const previous = queryClient.getQueryData<Food[]>(foodKeys.list());
      queryClient.setQueryData<Food[]>(foodKeys.list(), (current = []) =>
        sortFoods([...current, food]),
      );
      return { previous };
    },
    onError: (_error, _food, context) => {
      queryClient.setQueryData(foodKeys.list(), context?.previous);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: foodKeys.list() }),
  });
}
