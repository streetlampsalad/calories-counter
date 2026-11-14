import {
  getTipsWriter,
  handleTips,
  TIPS_DAILY_LIMIT,
} from "@/features/nutrition-tips/tips-handler";
import { DEFAULT_SETTINGS } from "@/features/settings/domain";
import { createClient } from "@/lib/supabase/server";

// Nutrition tips for last week (spec 219), counted against a daily allowance
// of its own. Entries are read with the User's own client, so RLS applies.
export async function POST(request: Request) {
  const supabase = await createClient();
  return handleTips(request, {
    userId: async () => {
      const { data } = await supabase.auth.getClaims();
      return data?.claims.sub ?? null;
    },
    weekStartsOn: async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("week_starts_on")
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_SETTINGS.weekStartsOn;
      return data.week_starts_on === 0 ? 0 : 1;
    },
    entries: async (from, to) => {
      const { data, error } = await supabase
        .from("entries")
        .select("food_id, day, quantity, foods(name, portion, calories)")
        .gte("day", from)
        .lte("day", to)
        .limit(5000);
      if (error) throw error;
      return data.flatMap((row) =>
        row.foods
          ? [
              {
                foodId: row.food_id,
                day: row.day,
                quantity: Number(row.quantity),
                name: row.foods.name,
                portion: row.foods.portion,
                calories: row.foods.calories,
              },
            ]
          : [],
      );
    },
    allowUse: async (kind) => {
      const { data, error } = await supabase.rpc("increment_ai_usage", {
        usage_kind: kind,
        max_per_day: TIPS_DAILY_LIMIT,
      });
      if (error) throw error;
      return data;
    },
    keepTips: async (weekStart, tips) => {
      const { error } = await supabase
        .from("nutrition_tips")
        .upsert(
          { week_start: weekStart, tips, created_at: new Date().toISOString() },
          { onConflict: "user_id,week_start" },
        );
      if (error) throw error;
    },
    writer: getTipsWriter(),
  });
}
