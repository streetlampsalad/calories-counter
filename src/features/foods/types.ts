import type { Tables } from "@/lib/supabase/database.types";

// A Food as the app uses it (see CONTEXT.md). Calories are whole kcal per one Portion.
export type Food = {
  id: string;
  name: string;
  portion: string;
  calories: number;
  archivedAt: string | null;
};

export type FoodInput = Pick<Food, "name" | "portion" | "calories">;

export type FoodRow = Tables<"foods">;
