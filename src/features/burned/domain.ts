// Calories Burned (spec 017): what a User's watch says they burned on a Day, resting plus activity.
// The Deficit is derived from it and the Daily Total and never stored (ADR 0001).

export const MIN_BURNED = 500;
export const MAX_BURNED = 10000;

const BURNED_ERROR = "Enter between 500 and 10,000 kcal";

export function parseBurned(
  text: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!/^[0-9]+$/.test(trimmed)) return { ok: false, error: BURNED_ERROR };
  const value = Number(trimmed);
  return value >= MIN_BURNED && value <= MAX_BURNED
    ? { ok: true, value }
    : { ok: false, error: BURNED_ERROR };
}

/** Calories Burned minus the Daily Total: positive is a Deficit, negative a Surplus. */
export const deficit = (dailyTotal: number, caloriesBurned: number) =>
  caloriesBurned - dailyTotal;

const kcal = (value: number) => `${value.toLocaleString("en-AU")} kcal`;

export function formatDeficit(value: number): string {
  return value >= 0
    ? `${kcal(value)} deficit`
    : `${kcal(Math.abs(value))} surplus`;
}

export type BurnedRowText = {
  /** What the row is about, with the figure when there is one. */
  heading: string;
  /** What to do or what it means. */
  detail: string;
};

// The Burned row under the Daily Total (AC-3). Today's burn is still rising, so it says "so far".
export function burnedRowText(input: {
  caloriesBurned: number | null;
  /** The Day has at least one Entry (even a zero-calorie one). */
  hasEntries: boolean;
  dailyTotal: number;
  isToday: boolean;
}): BurnedRowText {
  const label = input.isToday ? "Burned so far" : "Burned";
  if (input.caloriesBurned === null) return { heading: label, detail: "Add" };
  const heading = `${label} ${kcal(input.caloriesBurned)}`;
  if (!input.hasEntries) {
    return { heading, detail: "Log food to see your deficit" };
  }
  return {
    heading,
    detail: formatDeficit(deficit(input.dailyTotal, input.caloriesBurned)),
  };
}
