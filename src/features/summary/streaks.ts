import { shiftDay } from "@/features/entries/days";
import type { PeriodRange } from "./period";
import type { DayTotal } from "./summarise";

// Streaks look back this far rather than "ever": one cheap query that stays well under the
// database's row cap. A run longer than this is capped at this many Days.
export const HISTORY_DAYS = 400;

export function historyRange(today: string): { from: string; to: string } {
  return { from: shiftDay(today, -(HISTORY_DAYS - 1)), to: today };
}

function loggedCalories(totals: readonly DayTotal[], upTo?: string) {
  return new Map(
    totals
      .filter((t) => t.entryCount > 0 && (upTo === undefined || t.day <= upTo))
      .map((t) => [t.day, t.calories]),
  );
}

// Walks back from today (or yesterday, if today has nothing yet) while `keep` holds for each Day.
function runEndingNow(
  logged: ReadonlyMap<string, number>,
  today: string,
  keep: (calories: number) => boolean,
): number {
  let day = logged.has(today) ? today : shiftDay(today, -1);
  let run = 0;
  for (;;) {
    const calories = logged.get(day);
    if (calories === undefined || !keep(calories)) return run;
    run += 1;
    day = shiftDay(day, -1);
  }
}

// Consecutive Logged Days ending today, or yesterday if today has none yet.
export function currentStreak(
  totals: readonly DayTotal[],
  today: string,
): number {
  return runEndingNow(loggedCalories(totals, today), today, () => true);
}

// The longest run of consecutive Logged Days in the data.
export function longestStreak(totals: readonly DayTotal[]): number {
  const days = [...loggedCalories(totals).keys()].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous !== null && shiftDay(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return longest;
}

export type GoalSplit = { over: number; under: number; loggedDays: number };

// Logged Days in the Period past the Goal, and the rest. A Day exactly on the Goal is under it.
export function goalSplit(
  totals: readonly DayTotal[],
  range: PeriodRange,
  goal: number,
): GoalSplit {
  const inRange = new Set(range.days);
  const logged = totals.filter((t) => t.entryCount > 0 && inRange.has(t.day));
  const over = logged.filter((t) => t.calories > goal).length;
  return { over, under: logged.length - over, loggedDays: logged.length };
}

// Consecutive Logged Days at or under the Goal, ending today (or yesterday). A Day not logged or
// over the Goal ends the run.
export function underGoalRun(
  totals: readonly DayTotal[],
  today: string,
  goal: number,
): number {
  return runEndingNow(
    loggedCalories(totals, today),
    today,
    (calories) => calories <= goal,
  );
}
