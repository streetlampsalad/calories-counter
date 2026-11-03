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

// Empties a User's Log and Food List. Only for a User no other test touches (dan).
export async function resetUser(client: Client) {
  const entries = await client.from("entries").delete().not("id", "is", null);
  if (entries.error)
    throw new Error(`Could not reset entries: ${entries.error.message}`);
  const foods = await client.from("foods").delete().not("id", "is", null);
  if (foods.error)
    throw new Error(`Could not reset foods: ${foods.error.message}`);
}

// Back to the defaults: no Goal, weeks start on Monday. Only for a User no other test touches (eve).
export async function resetSettings(client: Client) {
  const { error } = await client
    .from("user_settings")
    .delete()
    .not("user_id", "is", null);
  if (error) throw new Error(`Could not reset settings: ${error.message}`);
}

// Many Entries in one call, for tests that need months of history.
export async function seedEntries(
  client: Client,
  entries: Array<{ foodId: string; day: string; quantity: number }>,
) {
  const rows = entries.map((entry) => ({
    food_id: entry.foodId,
    day: entry.day,
    quantity: entry.quantity,
  }));
  const { error } = await client.from("entries").insert(rows);
  if (error) throw new Error(`Could not seed entries: ${error.message}`);
}
