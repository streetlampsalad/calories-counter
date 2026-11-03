import type { Tables } from "@/lib/supabase/database.types";

// A candidate Food from outside the User's list (see CONTEXT.md: Suggestion). Whatever its source,
// it comes down to a name and either energy per 100 g/ml, a serving's energy, or an estimate.
export type Suggestion = {
  /** Stable within a result list, for React keys. */
  key: string;
  name: string;
  brand?: string;
  /** Energy per 100 g or 100 ml, when the source gives it. */
  per100?: { calories: number; unit: "g" | "ml" };
  /** One serving, when the source gives it: "30 g" and what it holds. */
  serving?: { calories: number; label: string };
  /** Where the values came from, shown on the form. */
  sourceLabel: string;
  /** A guess rather than a measured value. */
  estimate?: boolean;
  /** For an estimate: an Australian Portion and a one-line reason. */
  portion?: string;
  basis?: string;
};

export type ReferenceFoodRow = Pick<
  Tables<"reference_foods">,
  "id" | "source" | "name" | "calories_per_100" | "unit"
>;

export const AFCD_LABEL = "From the Australian Food Composition Database";

export function referenceSuggestion(row: ReferenceFoodRow): Suggestion {
  return {
    key: `reference:${row.id}`,
    name: row.name,
    per100: {
      calories: row.calories_per_100,
      unit: row.unit === "ml" ? "ml" : "g",
    },
    sourceLabel: row.source === "AFCD" ? AFCD_LABEL : "From a reference food",
  };
}

// "93 kcal per 100 g"
export const describePer100 = (per100: NonNullable<Suggestion["per100"]>) =>
  `${per100.calories.toLocaleString("en-AU")} kcal per 100 ${per100.unit}`;
