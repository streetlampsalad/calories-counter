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
  archived: () => [...foodKeys.all, "archived"] as const,
  entryCounts: () => [...foodKeys.all, "entry-counts"] as const,
  usage: () => [...foodKeys.all, "usage"] as const,
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

// How many Entries each Food has, planned ones included, keyed by Food id. Only fetched when asked for.
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

export function useArchivedFoods() {
  return useQuery({
    queryKey: foodKeys.archived(),
    queryFn: async (): Promise<Food[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("foods")
        .select("*")
        .not("archived_at", "is", null);
      if (error) throw error;
      return sortFoods(data.map(toFood));
    },
  });
}

const FOREIGN_KEY_VIOLATION = "23503";

type Removal = { food: Food; hasEntries: boolean };

// A Food that Entries refer to is archived, never deleted, so history stays true (ADR 0001).
// A Food with none is deleted for good. Both leave the list immediately.
export function useRemoveFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ food, hasEntries }: Removal) => {
      const supabase = createClient();
      const failure = () =>
        new Error(
          `Couldn't remove ${food.name}. Check your connection and try again.`,
        );

      const archive = async () => {
        const { data, error } = await supabase
          .from("foods")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", food.id)
          .select("id");
        if (error || !data?.length) throw failure();
        return "archived" as const;
      };
      if (hasEntries) return archive();

      const { data, error } = await supabase
        .from("foods")
        .delete()
        .eq("id", food.id)
        .select("id");
      // Entries appeared since the count was read: keep the history, archive instead.
      if (error?.code === FOREIGN_KEY_VIOLATION) return archive();
      if (error || !data?.length) throw failure();
      return "deleted" as const;
    },
    onMutate: ({ food }) =>
      patchList(queryClient, (current) =>
        current.filter((existing) => existing.id !== food.id),
      ),
    onError: (_error, _removal, context) => restoreList(queryClient, context),
    onSettled: () => queryClient.invalidateQueries({ queryKey: foodKeys.all }),
  });
}

/** What a bulk removal did, kept so Undo can reverse it. */
export type RemovedFoods = { archived: Food[]; deleted: Food[] };

// Several Foods at once (spec 014): all leave the list immediately, or all come back. The server
// archives each Food that has Entries and deletes the rest, and says which.
export function useRemoveFoods() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (foods: Food[]): Promise<RemovedFoods> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("remove_foods", {
        ids: foods.map((food) => food.id),
      });
      if (error || !data)
        throw new Error(
          "Couldn't remove those foods. Check your connection and try again.",
        );
      const outcomes = new Map(data.map((row) => [row.food_id, row.outcome]));
      return {
        archived: foods.filter((food) => outcomes.get(food.id) === "archived"),
        deleted: foods.filter((food) => outcomes.get(food.id) === "deleted"),
      };
    },
    onMutate: (foods) => {
      const gone = new Set(foods.map((food) => food.id));
      return patchList(queryClient, (current) =>
        current.filter((existing) => !gone.has(existing.id)),
      );
    },
    onError: (_error, _foods, context) => restoreList(queryClient, context),
    onSettled: () => queryClient.invalidateQueries({ queryKey: foodKeys.all }),
  });
}

const restoreFailure = (error: SaveError) =>
  error?.code === UNIQUE_VIOLATION
    ? new Error("You already have a food with the same name and portion.")
    : new Error(
        "Couldn't bring those foods back. Check your connection and try again.",
      );

// Undo for a bulk removal: Archived Foods are restored and deleted ones are re-created with their
// original ids and values.
export function useRestoreFoods() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ archived, deleted }: RemovedFoods) => {
      const supabase = createClient();
      if (archived.length > 0) {
        const { error } = await supabase.rpc("restore_foods", {
          ids: archived.map((food) => food.id),
        });
        if (error) throw restoreFailure(error);
      }
      if (deleted.length > 0) {
        const { error } = await supabase.from("foods").insert(
          deleted.map(({ id, name, portion, calories }) => ({
            id,
            name,
            portion,
            calories,
          })),
        );
        if (error) throw restoreFailure(error);
      }
    },
    onMutate: async ({ archived, deleted }) => {
      await queryClient.cancelQueries({ queryKey: foodKeys.all });
      const previousList = queryClient.getQueryData<Food[]>(foodKeys.list());
      const previousArchived = queryClient.getQueryData<Food[]>(
        foodKeys.archived(),
      );
      const back = new Set(archived.map((food) => food.id));
      queryClient.setQueryData<Food[]>(foodKeys.archived(), (current = []) =>
        current.filter((existing) => !back.has(existing.id)),
      );
      queryClient.setQueryData<Food[]>(foodKeys.list(), (current = []) =>
        sortFoods([
          ...current,
          ...[...archived, ...deleted].map((food) => ({
            ...food,
            archivedAt: null,
          })),
        ]),
      );
      return { previousList, previousArchived };
    },
    onError: (_error, _removed, context) => {
      queryClient.setQueryData(foodKeys.list(), context?.previousList);
      queryClient.setQueryData(foodKeys.archived(), context?.previousArchived);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: foodKeys.all }),
  });
}

// Brings an Archived Food back into the list. Refused if a live Food now has its name and Portion.
export function useRestoreFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (food: Food) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("foods")
        .update({ archived_at: null })
        .eq("id", food.id)
        .select("id");
      if (error || !data?.length) throw saveFailure(error, food);
    },
    onMutate: async (food) => {
      await queryClient.cancelQueries({ queryKey: foodKeys.all });
      const previousList = queryClient.getQueryData<Food[]>(foodKeys.list());
      const previousArchived = queryClient.getQueryData<Food[]>(
        foodKeys.archived(),
      );
      queryClient.setQueryData<Food[]>(foodKeys.archived(), (current = []) =>
        current.filter((existing) => existing.id !== food.id),
      );
      queryClient.setQueryData<Food[]>(foodKeys.list(), (current = []) =>
        sortFoods([...current, { ...food, archivedAt: null }]),
      );
      return { previousList, previousArchived };
    },
    onError: (_error, _food, context) => {
      queryClient.setQueryData(foodKeys.list(), context?.previousList);
      queryClient.setQueryData(foodKeys.archived(), context?.previousArchived);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: foodKeys.all }),
  });
}
