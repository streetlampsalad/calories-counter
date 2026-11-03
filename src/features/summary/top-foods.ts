export const TOP_LIMIT = 10;

// One Food's total over a Period, as the database reports it.
export type FoodTotal = {
  foodId: string;
  name: string;
  portion: string;
  archived: boolean;
  calories: number;
  entryCount: number;
};

export type TopBy = "calories" | "times";

export type TopFood = FoodTotal & {
  /** Percent of everything eaten in the Period (all Foods, not only those shown). */
  sharePct: number;
};

const collator = new Intl.Collator("en-AU", {
  sensitivity: "base",
  numeric: true,
});

// The Foods that account for the most calories (or are logged most often), with each one's share.
export function topFoods(
  rows: readonly FoodTotal[],
  by: TopBy,
  limit = TOP_LIMIT,
): TopFood[] {
  const everything = rows.reduce((sum, row) => sum + row.calories, 0);
  return [...rows]
    .sort((a, b) =>
      by === "calories"
        ? b.calories - a.calories || collator.compare(a.name, b.name)
        : b.entryCount - a.entryCount ||
          b.calories - a.calories ||
          collator.compare(a.name, b.name),
    )
    .slice(0, limit)
    .map((row) => ({
      ...row,
      sharePct:
        everything === 0 ? 0 : Math.round((row.calories / everything) * 100),
    }));
}
