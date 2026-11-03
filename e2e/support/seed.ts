import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export const unique = (base: string) =>
  `${base} ${Math.random().toString(36).slice(2, 8)}`;

// Arranges a Food directly in the database, with a unique name so tests never collide.
export async function seedFood(
  client: Client,
  food: { name?: string; portion?: string; calories: number },
) {
  const name = food.name ?? unique("Seeded food");
  const portion = food.portion ?? "1 serve";
  const { data, error } = await client
    .from("foods")
    .insert({ name, portion, calories: food.calories })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not seed food: ${error?.message}`);
  return { id: data.id, name, portion, calories: food.calories };
}

// Tests that assert on totals use a fixed past Day of their own, emptied first so a re-run starts clean.
export async function clearDay(client: Client, day: string) {
  const { error } = await client.from("entries").delete().eq("day", day);
  if (error) throw new Error(`Could not clear ${day}: ${error.message}`);
}

// Entries are inserted one at a time, so their created_at order is the order of the calls.
export async function seedEntry(
  client: Client,
  entry: { foodId: string; day: string; quantity: number },
) {
  const { error } = await client.from("entries").insert({
    food_id: entry.foodId,
    day: entry.day,
    quantity: entry.quantity,
  });
  if (error) throw new Error(`Could not seed entry: ${error.message}`);
}
