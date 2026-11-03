import type { PeriodRange } from "./period";

// One Day's total, as the database reports it. Days with no Entries are simply absent.
export type DayTotal = {
  day: string;
  calories: number;
  entryCount: number;
};

export type Summary = {
  total: number;
  /** Days in the Period with at least one Entry. */
  loggedDays: number;
  daysInRange: number;
  /** Total over logged Days only, so a Day not logged is "not logged", never zero. Null if none. */
  averagePerLoggedDay: number | null;
  /** Logged Days that went past the Goal. Zero without a Goal. */
  overGoalDays: number;
  /** Average minus Goal: negative is under, positive is over. Null without a Goal or a logged Day. */
  averageVsGoal: number | null;
};

export function summarise(
  totals: readonly DayTotal[],
  range: PeriodRange,
  goal: number | null,
): Summary {
  const inRange = new Set(range.days);
  const logged = totals.filter(
    (day) => inRange.has(day.day) && day.entryCount > 0,
  );
  const total = logged.reduce((sum, day) => sum + day.calories, 0);
  const average = logged.length > 0 ? Math.round(total / logged.length) : null;

  return {
    total,
    loggedDays: logged.length,
    daysInRange: range.days.length,
    averagePerLoggedDay: average,
    overGoalDays:
      goal === null ? 0 : logged.filter((day) => day.calories > goal).length,
    averageVsGoal: goal !== null && average !== null ? average - goal : null,
  };
}
