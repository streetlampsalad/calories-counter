import { dayOfWeek } from "@/features/entries/days";
import type { WeekStart } from "@/features/settings/domain";
import type { PeriodRange } from "./period";
import type { DayTotal } from "./summarise";

// Below a fortnight a weekday has one or two samples, which says more about those days than the weekday.
export const MIN_LOGGED_DAYS_FOR_WEEKDAYS = 14;

const NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type WeekdayAverage = {
  /** 0 is Sunday, as in Date.getUTCDay. */
  weekday: number;
  name: string;
  short: string;
  /** Average Calories over that weekday's Logged Days; null if it was never logged. */
  average: number | null;
  loggedDays: number;
};

const number = (value: number) => value.toLocaleString("en-AU");

function loggedInRange(totals: readonly DayTotal[], range: PeriodRange) {
  const days = new Set(range.days);
  return totals.filter((t) => t.entryCount > 0 && days.has(t.day));
}

export function hasEnoughWeekdayData(
  totals: readonly DayTotal[],
  range: PeriodRange,
): boolean {
  return loggedInRange(totals, range).length >= MIN_LOGGED_DAYS_FOR_WEEKDAYS;
}

// The average Calories per Logged Day for each weekday, in week order. A Day not logged is left
// out rather than counted as zero.
export function dayOfWeekAverages(
  totals: readonly DayTotal[],
  range: PeriodRange,
  weekStartsOn: WeekStart,
): WeekdayAverage[] {
  const logged = loggedInRange(totals, range);
  return Array.from({ length: 7 }, (_, i) => {
    const weekday = (weekStartsOn + i) % 7;
    const values = logged
      .filter((t) => dayOfWeek(t.day) === weekday)
      .map((t) => t.calories);
    const name = NAMES[weekday];
    return {
      weekday,
      name,
      short: name.slice(0, 3),
      average:
        values.length > 0
          ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
          : null,
      loggedDays: values.length,
    };
  });
}

// The weekday with the highest average; the earlier one in the week on a tie.
export function busiestWeekday(
  averages: readonly WeekdayAverage[],
): WeekdayAverage | null {
  let best: WeekdayAverage | null = null;
  for (const entry of averages) {
    if (entry.average === null) continue;
    if (best === null || entry.average > (best.average ?? 0)) best = entry;
  }
  return best;
}

// "Saturdays average 2,600 kcal"
export function dayOfWeekHeadline(
  averages: readonly WeekdayAverage[],
): string | null {
  const best = busiestWeekday(averages);
  if (best === null || best.average === null) return null;
  return `${best.name}s average ${number(best.average)} kcal`;
}
