"use client";

import { useQuery } from "@tanstack/react-query";
import { entryKeys } from "@/lib/query-keys";
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
