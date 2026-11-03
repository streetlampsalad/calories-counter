import { fakeOffFetch } from "@/features/search/fake-off";
import { handleProducts } from "@/features/search/products-handler";
import { createClient } from "@/lib/supabase/server";

// Packaged products from Open Food Facts, searched on the server so the app identifies itself
// properly and answers can be cached. Tests answer from a recording instead (OFF_SOURCE=fixture).
export async function GET(request: Request) {
  const supabase = await createClient();
  return handleProducts(request, {
    userId: async () => {
      const { data } = await supabase.auth.getClaims();
      return data?.claims.sub ?? null;
    },
    fetch: process.env.OFF_SOURCE === "fixture" ? fakeOffFetch : fetch,
  });
}
