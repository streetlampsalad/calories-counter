import { shortDate } from "@/features/entries/days";
import type { PeriodRange } from "./period";
import type { DayTotal } from "./summarise";

export const WINDOW_DAYS = 7;
// Below this a trend is mostly noise, so the card says so instead of drawing one.
export const MIN_LOGGED_DAYS = 7;
// A move smaller than this is day-to-day wobble, not a trend.
const STEADY_WITHIN = 25;

export type TrendPoint = { day: string; average: number | null };

const number = (value: number) => value.toLocaleString("en-AU");

function loggedCalories(
  totals: readonly DayTotal[],
  days: ReadonlySet<string>,
) {
  return new Map(
    totals
      .filter((t) => t.entryCount > 0 && days.has(t.day))
      .map((t) => [t.day, t.calories]),
  );
}

export function hasEnoughData(
  totals: readonly DayTotal[],
  range: PeriodRange,
): boolean {
  return loggedCalories(totals, new Set(range.days)).size >= MIN_LOGGED_DAYS;
}

// For each Day, the average of the Days actually logged in the 7 Days up to it. A Day not logged is
// left out of the average rather than counted as zero. The line starts once a full window exists.
export function rollingAverage(
  totals: readonly DayTotal[],
  range: PeriodRange,
): TrendPoint[] {
  const logged = loggedCalories(totals, new Set(range.days));
  return range.days.map((day, i) => {
    if (i < WINDOW_DAYS - 1) return { day, average: null };
    const values = range.days
      .slice(i - WINDOW_DAYS + 1, i + 1)
      .flatMap((windowDay) => logged.get(windowDay) ?? []);
    const average =
      values.length > 0
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : null;
    return { day, average };
  });
}

// "Your 7-day average is down 120 kcal since 12 Aug", comparing the first and last averages.
export function trendHeadline(points: readonly TrendPoint[]): string | null {
  const defined = points.filter(
    (p): p is { day: string; average: number } => p.average !== null,
  );
  if (defined.length < 2) return null;
  const first = defined[0];
  const last = defined[defined.length - 1];
  const change = last.average - first.average;
  if (Math.abs(change) < STEADY_WITHIN) {
    return `Your 7-day average is steady at ${number(last.average)} kcal`;
  }
  return `Your 7-day average is ${change < 0 ? "down" : "up"} ${number(Math.abs(change))} kcal since ${shortDate(first.day)}`;
}

export type TrendGeometry = {
  /** SVG path data on a 100 x 100 canvas, one per unbroken run of averages. */
  segments: string[];
  lo: number;
  hi: number;
  /** Height of the Goal line from the bottom, 0 to 100. */
  goalPct: number | null;
  last: { day: string; average: number; pct: number } | null;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export function buildTrend(
  points: readonly TrendPoint[],
  goal: number | null,
): TrendGeometry {
  const values = points.flatMap((p) => (p.average === null ? [] : [p.average]));
  if (values.length === 0)
    return { segments: [], lo: 0, hi: 100, goalPct: null, last: null };

  const low = Math.min(...values, ...(goal === null ? [] : [goal]));
  const high = Math.max(...values, ...(goal === null ? [] : [goal]));
  const pad = Math.max(high - low, 200) * 0.1;
  const lo = Math.max(0, Math.floor(low - pad));
  const hi = Math.ceil(high + pad);

  const fromBottom = (value: number) => ((value - lo) / (hi - lo)) * 100;
  const x = (i: number) =>
    points.length > 1 ? round1((i / (points.length - 1)) * 100) : 0;
  const y = (value: number) => round1(100 - fromBottom(value));

  const segments: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length === 1) run.push(run[0]);
    if (run.length > 0) segments.push(`M${run.join(" L")}`);
    run = [];
  };
  points.forEach((point, i) => {
    if (point.average === null) flush();
    else run.push(`${x(i)},${y(point.average)}`);
  });
  flush();

  const lastPoint = [...points].reverse().find((p) => p.average !== null);
  return {
    segments,
    lo,
    hi,
    goalPct: goal === null ? null : Math.round(fromBottom(goal)),
    last:
      lastPoint && lastPoint.average !== null
        ? {
            day: lastPoint.day,
            average: lastPoint.average,
            pct: round1(fromBottom(lastPoint.average)),
          }
        : null,
  };
}
