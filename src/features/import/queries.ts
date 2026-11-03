"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { foodKeys } from "@/features/foods/queries";
import { entryKeys, summaryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import type { ImportPayloadRow } from "./review";

export type ImportResult = { added: number; updated: number };

// The database's own wording means little to a User, so the common failures get a plain one.
function explain(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "23505":
      return "One of these foods is already in your list. Nothing was saved; check the rows and try again.";
    case "23514":
      return "A row has a value that isn't allowed. Nothing was saved; check the rows and try again.";
    case "P0002":
      return "A food you chose to update is no longer in your list. Nothing was saved; check the rows and try again.";
    default:
      return `Couldn't save: ${error.message}. Nothing was saved.`;
  }
}

// Saves the whole Import in one database call, so it all happens or none of it does. Not
// optimistic: the User is told only once it is really saved.
export function useImportFoods() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ImportPayloadRow[]): Promise<ImportResult> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("import_foods", { rows });
      if (error) throw new Error(explain(error));
      const [counts] = data ?? [];
      return { added: counts?.added ?? 0, updated: counts?.updated ?? 0 };
    },
    onSuccess: () =>
      // Updated Calories feed every Daily Total (ADR 0001), so anything derived from them is stale.
      Promise.all([
        queryClient.invalidateQueries({ queryKey: foodKeys.all }),
        queryClient.invalidateQueries({ queryKey: entryKeys.all }),
        queryClient.invalidateQueries({ queryKey: summaryKeys.all }),
      ]),
  });
}
