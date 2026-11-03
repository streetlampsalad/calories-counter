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
import type { Entry } from "./types";

// An Entry plus the Food it refers to, joined so the calories are always the Food's current ones.
export const ENTRY_SELECT =
  "id, day, quantity, created_at, food:foods!inner(id, name, portion, calories)";

type EntryRow = {
  id: string;
  day: string;
  quantity: number;
  created_at: string;
  food: { id: string; name: string; portion: string; calories: number };
};

export const toEntry = (row: EntryRow): Entry => ({
  id: row.id,
  day: row.day,
  quantity: Number(row.quantity),
  createdAt: row.created_at,
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

// Also used to bring a removed Entry back (Undo): the same id and time put it back in place.
export function useAddEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: Entry) => {
      const supabase = createClient();
      const { error } = await supabase.from("entries").insert({
        id: entry.id,
        food_id: entry.food.id,
        day: entry.day,
        quantity: entry.quantity,
        created_at: entry.createdAt,
      });
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
