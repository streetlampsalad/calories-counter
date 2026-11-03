export type MetricPortion = { amount: number; unit: "g" | "ml" };

const UNITS: Record<string, { unit: "g" | "ml"; factor: number }> = {
  g: { unit: "g", factor: 1 },
  gram: { unit: "g", factor: 1 },
  grams: { unit: "g", factor: 1 },
  kg: { unit: "g", factor: 1000 },
  ml: { unit: "ml", factor: 1 },
  millilitre: { unit: "ml", factor: 1 },
  millilitres: { unit: "ml", factor: 1 },
  l: { unit: "ml", factor: 1000 },
  litre: { unit: "ml", factor: 1000 },
  litres: { unit: "ml", factor: 1000 },
};

// "150 g" or "250 ml" (and kg, l, and the spelt-out units) as an amount in grams or millilitres.
// Anything else, like "1 cup" or "1 slice", can't be scaled by weight, so it is null.
export function parseMetricPortion(text: string): MetricPortion | null {
  const match = /^\s*([0-9]+(?:[.,][0-9]+)?)\s*([a-z]+)\s*$/i.exec(text);
  if (!match) return null;
  const unit = UNITS[match[2].toLowerCase()];
  const amount = Number(match[1].replace(",", ".")) * (unit?.factor ?? 0);
  if (!unit || !(amount > 0)) return null;
  return { amount: Math.round(amount * 1000) / 1000, unit: unit.unit };
}

// Calories in `amount` g or ml of a food that has `per100` Calories per 100, to the nearest whole
// Calorie (halves round up). The tiny nudge keeps a value like 139.4999999 from rounding down.
export const scaleCalories = (per100: number, amount: number) =>
  Math.round((per100 * amount) / 100 + 1e-9);
