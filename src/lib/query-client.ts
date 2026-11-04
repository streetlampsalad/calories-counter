import { MutationCache, QueryClient } from "@tanstack/react-query";
import { haptic } from "./haptics";

export function makeQueryClient() {
  return new QueryClient({
    // Every save that fails is rolled back by its own mutation; this is the one place that tells
    // the User by feel as well (spec 015 AC-8).
    mutationCache: new MutationCache({ onError: () => haptic("error") }),
    defaultOptions: {
      queries: {
        // A User's data only changes through this app, so cached data stays
        // fresh until a mutation invalidates it.
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
