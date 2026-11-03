"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { referenceSuggestion, type Suggestion } from "./suggestions";

export const MIN_QUERY = 2;

export const searchKeys = {
  all: ["search"] as const,
  reference: (q: string) => [...searchKeys.all, "reference", q] as const,
};

// Australian reference foods matching a query, from the database's own search.
export function useReferenceSearch(q: string) {
  return useQuery({
    queryKey: searchKeys.reference(q),
    enabled: q.length >= MIN_QUERY,
    // Reference data hardly ever changes, so a repeat search can come straight from memory.
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Suggestion[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("search_reference_foods", {
        q,
        max_results: 20,
      });
      if (error) throw error;
      return data.map(referenceSuggestion);
    },
  });
}
