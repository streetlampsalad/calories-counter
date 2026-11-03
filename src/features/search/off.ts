import { MAX_CALORIES, MAX_NAME } from "@/features/foods/validation";
import { KILOJOULES_PER_CALORIE } from "@/lib/energy";
import type { Suggestion } from "./suggestions";

export const OFF_LABEL = "From Open Food Facts";

const number = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

// Whole Calories from what a product says. Open Food Facts is edited by anyone, so its kcal and kJ
// can disagree; Australian labels are in kJ, so when they are far apart the kJ figure wins.
function calories(kcalValue: unknown, kjValue: unknown): number | null {
  const kcal = number(kcalValue);
  const kj = number(kjValue);
  const fromKcal = kcal !== null && kcal >= 0 ? Math.round(kcal) : null;
  const exactFromKj =
    kj !== null && kj >= 0 ? kj / KILOJOULES_PER_CALORIE : null;
  const fromKj = exactFromKj === null ? null : Math.round(exactFromKj);

  let chosen = fromKcal ?? fromKj;
  if (fromKcal !== null && exactFromKj !== null) {
    const close =
      Math.abs(fromKcal - exactFromKj) <= 0.15 * Math.max(exactFromKj, 1);
    chosen = close ? fromKcal : fromKj;
  }
  return chosen !== null && chosen <= MAX_CALORIES ? chosen : null;
}

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

function mapProduct(raw: unknown): Suggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const product = raw as Record<string, unknown>;
  const code = typeof product.code === "string" ? product.code : null;
  const name = text(product.product_name).slice(0, MAX_NAME).trim();
  if (!code || !name) return null;

  const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;
  const per100Calories = calories(
    nutriments["energy-kcal_100g"],
    nutriments["energy-kj_100g"],
  );
  const servingCalories = calories(
    nutriments["energy-kcal_serving"],
    nutriments["energy-kj_serving"],
  );
  const servingLabel = text(product.serving_size);
  if (per100Calories === null && (servingCalories === null || !servingLabel)) {
    return null;
  }

  const brand = text(product.brands).split(",")[0].trim();
  return {
    key: `off:${code}`,
    name,
    ...(brand ? { brand } : {}),
    ...(per100Calories !== null
      ? { per100: { calories: per100Calories, unit: "g" as const } }
      : {}),
    ...(servingCalories !== null && servingLabel
      ? { serving: { calories: servingCalories, label: servingLabel } }
      : {}),
    sourceLabel: OFF_LABEL,
  };
}

// Open Food Facts' search response as Suggestions, leaving out anything without a usable name or energy.
export function mapOffProducts(response: unknown): Suggestion[] {
  const products = (response as { products?: unknown } | null)?.products;
  if (!Array.isArray(products)) return [];
  return products.flatMap((raw) => mapProduct(raw) ?? []);
}
