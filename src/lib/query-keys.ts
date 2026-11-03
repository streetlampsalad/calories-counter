// Roots of the caches that depend on a Food's Calories. Features extend these with their own
// narrower keys, and a Food edit invalidates every root (ADR 0001: totals follow the Food).
export const entryKeys = {
  all: ["entries"] as const,
  day: (day: string) => ["entries", "day", day] as const,
};
export const summaryKeys = {
  all: ["summary"] as const,
  period: (from: string, to: string) =>
    ["summary", "period", from, to] as const,
  foods: (from: string, to: string) => ["summary", "foods", from, to] as const,
};
