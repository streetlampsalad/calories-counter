"use client";

import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { foodKeys } from "@/features/foods/queries";
import { entryKeys, summaryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { isMealTime, type MealTime } from "./meal-time";
import type { Entry } from "./types";
import type { FoodUsage } from "./usage";

// An Entry plus the Food it refers to, joined so the calories are always the Food's current ones.
export const ENTRY_SELECT =
  "id, day, quantity, created_at, meal_time, food:foods!inner(id, name, portion, calories)";

type EntryRow = {
  id: string;
  day: string;
  quantity: number;
  created_at: string;
  meal_time?: string | null;
  food: { id: string; name: string; portion: string; calories: number };
};

export const toEntry = (row: EntryRow): Entry => ({
  id: row.id,
  day: row.day,
  quantity: Number(row.quantity),
  createdAt: row.created_at,
  mealTime: isMealTime(row.meal_time) ? row.meal_time : null,
  food: row.food,
});

async function fetchDayEntries(day: string): Promise<Entry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("entries")
    .select(ENTRY_SELECT)
    .eq("day", day)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as EntryRow[]).map(toEntry);
}

// Newest first. Archived Foods are included: their Entries still count.
export function useDayEntries(day: string) {
  return useQuery({
    queryKey: entryKeys.day(day),
    queryFn: () => fetchDayEntries(day),
  });
}

// Optimistic updates for one Day's list: change it now, keep a copy to put back on failure.
async function patchDay(
  queryClient: QueryClient,
  day: string,
  change: (entries: Entry[]) => Entry[],
) {
  await queryClient.cancelQueries({ queryKey: entryKeys.day(day) });
  const previous = queryClient.getQueryData<Entry[]>(entryKeys.day(day));
  queryClient.setQueryData<Entry[]>(entryKeys.day(day), (current = []) =>
    change(current),
  );
  return { previous };
}

// Logging changes totals, and how often each Food is used, and whether a Food has history.
function refreshAfterChange(queryClient: QueryClient, day: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: entryKeys.day(day) }),
    queryClient.invalidateQueries({ queryKey: summaryKeys.all }),
    queryClient.invalidateQueries({ queryKey: foodKeys.entryCounts() }),
    queryClient.invalidateQueries({ queryKey: foodKeys.usage() }),
  ]);
}

const SAVE_FAILED = "Couldn't save that. Check your connection and try again.";

const toRow = (entry: Entry) => ({
  id: entry.id,
  food_id: entry.food.id,
  day: entry.day,
  quantity: entry.quantity,
  created_at: entry.createdAt,
  meal_time: entry.mealTime ?? null,
});

const newestFirst = (entries: Entry[]) =>
  [...entries].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );

// Also used to bring a removed Entry back (Undo): the same id and time put it back in place.
export function useAddEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: Entry) => {
      const supabase = createClient();
      const { error } = await supabase.from("entries").insert(toRow(entry));
      if (error) throw new Error(SAVE_FAILED);
    },
    onMutate: (entry) =>
      patchDay(queryClient, entry.day, (current) => [entry, ...current]),
    onError: (_error, entry, context) =>
      queryClient.setQueryData(entryKeys.day(entry.day), context?.previous),
    onSettled: (_data, _error, entry) =>
      refreshAfterChange(queryClient, entry.day),
  });
}

// Several Entries of one Day at once: Undo for a bulk delete (spec 014). One request, and each
// Entry keeps its own id and time, so the list looks as it did.
export function useAddEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entries: Entry[]) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("entries")
        .insert(entries.map(toRow));
      if (error) throw new Error(SAVE_FAILED);
    },
    onMutate: (entries) =>
      patchDay(queryClient, entries[0].day, (current) =>
        newestFirst([...entries, ...current]),
      ),
    onError: (_error, entries, context) =>
      queryClient.setQueryData(
        entryKeys.day(entries[0].day),
        context?.previous,
      ),
    onSettled: (_data, _error, entries) =>
      refreshAfterChange(queryClient, entries[0].day),
  });
}

// Several Entries of one Day at once (spec 014): all go from the list immediately, or all come back.
export function useRemoveEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entries: Entry[]) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("entries")
        .delete()
        .in(
          "id",
          entries.map((entry) => entry.id),
        );
      if (error) throw new Error(SAVE_FAILED);
    },
    onMutate: (entries) => {
      const gone = new Set(entries.map((entry) => entry.id));
      return patchDay(queryClient, entries[0].day, (current) =>
        current.filter((entry) => !gone.has(entry.id)),
      );
    },
    onError: (_error, entries, context) =>
      queryClient.setQueryData(
        entryKeys.day(entries[0].day),
        context?.previous,
      ),
    onSettled: (_data, _error, entries) =>
      refreshAfterChange(queryClient, entries[0].day),
  });
}

export function useRemoveEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: Entry) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("entries")
        .delete()
        .eq("id", entry.id);
      if (error) throw new Error(SAVE_FAILED);
    },
    onMutate: (entry) =>
      patchDay(queryClient, entry.day, (current) =>
        current.filter((e) => e.id !== entry.id),
      ),
    onError: (_error, entry, context) =>
      queryClient.setQueryData(entryKeys.day(entry.day), context?.previous),
    onSettled: (_data, _error, entry) =>
      refreshAfterChange(queryClient, entry.day),
  });
}

export function useUpdateEntryQuantity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entry,
      quantity,
    }: {
      entry: Entry;
      quantity: number;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("entries")
        .update({ quantity })
        .eq("id", entry.id)
        .select("id");
      // Row-level security hides other Users' Entries by matching no row, not by erroring.
      if (error || !data?.length) throw new Error(SAVE_FAILED);
    },
    onMutate: ({ entry, quantity }) =>
      patchDay(queryClient, entry.day, (current) =>
        current.map((e) => (e.id === entry.id ? { ...e, quantity } : e)),
      ),
    onError: (_error, { entry }, context) =>
      queryClient.setQueryData(entryKeys.day(entry.day), context?.previous),
    onSettled: (_data, _error, { entry }) =>
      refreshAfterChange(queryClient, entry.day),
  });
}

export function useUpdateEntryMealTime() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entry,
      mealTime,
    }: {
      entry: Entry;
      mealTime: MealTime | null;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("entries")
        .update({ meal_time: mealTime })
        .eq("id", entry.id)
        .select("id");
      // Row-level security hides other Users' Entries by matching no row, not by erroring.
      if (error || !data?.length) throw new Error(SAVE_FAILED);
    },
    onMutate: ({ entry, mealTime }) =>
      patchDay(queryClient, entry.day, (current) =>
        current.map((e) => (e.id === entry.id ? { ...e, mealTime } : e)),
      ),
    onError: (_error, { entry }, context) =>
      queryClient.setQueryData(entryKeys.day(entry.day), context?.previous),
    onSettled: (_data, _error, { entry }) =>
      refreshAfterChange(queryClient, entry.day),
  });
}

// How often and how recently each Food was eaten from `since` to `until` (today), for ordering the
// picker. Planned Entries, on Days after today, are left out.
// Under the foods "usage" key, so adding or removing an Entry refreshes it.
export function useFoodUsage(since: string, until: string, enabled: boolean) {
  return useQuery({
    queryKey: [...foodKeys.usage(), since, until],
    enabled,
    queryFn: async (): Promise<FoodUsage[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("food_usage", {
        since,
        until,
      });
      if (error) throw error;
      return data.map((row) => ({
        foodId: row.food_id,
        entryCount: Number(row.entry_count),
        lastLoggedAt: row.last_logged_at,
      }));
    },
  });
}
