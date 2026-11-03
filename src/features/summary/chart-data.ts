import { dayOfWeek } from "@/features/entries/days";
import type { PeriodRange } from "./period";
import type { DayTotal } from "./summarise";

export type Bar = {
  day: string;
  /** The Day's total, or null when nothing was logged (an empty slot, never a zero bar). */
  calories: number | null;
  logged: boolean;
  /** Past the Goal. Exactly on it is not over. */
  over: boolean;
  /** 0 to 100, against the chart's top. */
  heightPct: number;
};

export type ChartData = {
  bars: Bar[];
  /** The value at the top of the chart. */
  yMax: number;
  /** Where the Goal line sits, 0 to 100, or null without a Goal. */
  goalPct: number | null;
};

// A tidy top for the scale, so the tallest bar is neither clipped nor flush against it.
export function niceMax(value: number): number {
  if (value <= 100) return 100;
  if (value <= 5000) return Math.ceil(value / 500) * 500;
  return Math.ceil(value / 2500) * 2500;
}

// A logged Day that totals zero (water) stays visible as a sliver, unlike a Day not logged.
const ZERO_SLIVER_PCT = 1;

export function buildBars(
  totals: readonly DayTotal[],
  range: PeriodRange,
  goal: number | null,
): ChartData {
  const byDay = new Map(
    totals.filter((t) => t.entryCount > 0).map((t) => [t.day, t.calories]),
  );
  const peak = Math.max(
    0,
    goal ?? 0,
    ...range.days.map((day) => byDay.get(day) ?? 0),
  );
  const yMax = niceMax(peak);

  const bars = range.days.map((day): Bar => {
    const calories = byDay.get(day) ?? null;
    return {
      day,
      calories,
      logged: calories !== null,
      over: goal !== null && calories !== null && calories > goal,
      heightPct:
        calories === null
          ? 0
          : calories === 0
            ? ZERO_SLIVER_PCT
            : (calories / yMax) * 100,
    };
  });

  return {
    bars,
    yMax,
    goalPct: goal === null ? null : Math.round((goal / yMax) * 100),
  };
}

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const month = (day: string) => MONTHS[Number(day.slice(5, 7)) - 1];
const date = (day: string) => Number(day.slice(8, 10));

// One label per Day, mostly empty: a week gets every weekday letter; longer Periods get a label
// about once a week plus the 1st of each month, so labels never collide.
export function axisLabels(days: readonly string[]): string[] {
  if (days.length <= 7) return days.map((day) => LETTERS[dayOfWeek(day)]);

  const firsts = new Set(
    days.flatMap((day, i) => (date(day) === 1 ? [i] : [])),
  );
  return days.map((day, i) => {
    if (firsts.has(i) || i === 0) return `${date(day)} ${month(day)}`;
    const crowded = [...firsts].some((first) => Math.abs(first - i) < 3);
    return i % 7 === 0 && !crowded ? String(date(day)) : "";
  });
}
