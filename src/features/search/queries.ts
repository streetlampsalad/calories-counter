"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { MIN_QUERY } from "./limits";
import { referenceSuggestion, type Suggestion } from "./suggestions";

export const searchKeys = {
  all: ["search"] as const,
  products: (q: string) => [...searchKeys.all, "products", q] as const,
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

// Packaged products matching a query, from Open Food Facts through our own server. If it is
// slow or down the query fails, and the screen says that section is unavailable.
export function useProductSearch(q: string) {
  return useQuery({
    queryKey: searchKeys.products(q),
    enabled: q.length >= MIN_QUERY,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<Suggestion[]> => {
      const response = await fetch(
        `/api/search/products?q=${encodeURIComponent(q)}`,
      );
      if (!response.ok) throw new Error("Packaged products are unavailable");
      const { products } = (await response.json()) as {
        products: Suggestion[];
      };
      return products;
    },
  });
}
