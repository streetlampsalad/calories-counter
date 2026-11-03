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
  /** For an estimate: an Australian Portion, its Calories and a one-line reason. */
  portion?: string;
  calories?: number;
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

// What to call the Food: "Arnott's Tim Tam", unless the name already says the brand.
export function foodName(
  suggestion: Pick<Suggestion, "name" | "brand">,
): string {
  const { name, brand } = suggestion;
  if (!brand || name.toLowerCase().includes(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}

// "524 kcal per 100 g · 96 kcal per serving"
export function describeEnergy(suggestion: Suggestion): string {
  const parts = [
    suggestion.per100 ? describePer100(suggestion.per100) : null,
    suggestion.serving
      ? `${suggestion.serving.calories.toLocaleString("en-AU")} kcal per serving`
      : null,
  ];
  return parts.filter((part) => part !== null).join(" · ");
}
