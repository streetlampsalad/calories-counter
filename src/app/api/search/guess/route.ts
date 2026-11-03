import {
  GUESS_DAILY_LIMIT,
  getCalorieGuesser,
  handleGuess,
} from "@/features/search/guess-handler";
import { createClient } from "@/lib/supabase/server";

// An estimate for a food no database knows, from the AI guesser. Counted against the same daily
// allowance as photo reading, under its own kind.
export async function POST(request: Request) {
  const supabase = await createClient();
  return handleGuess(request, {
    userId: async () => {
      const { data } = await supabase.auth.getClaims();
      return data?.claims.sub ?? null;
    },
    allowUse: async (kind) => {
      const { data, error } = await supabase.rpc("increment_ai_usage", {
        usage_kind: kind,
        max_per_day: GUESS_DAILY_LIMIT,
      });
      if (error) throw error;
      return data;
    },
    guesser: getCalorieGuesser(),
  });
}
