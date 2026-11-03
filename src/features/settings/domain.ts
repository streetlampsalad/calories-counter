export type WeekStart = 0 | 1;

// A User with no saved settings has these. Nothing is created at sign-up.
export type Settings = {
  /** Whole kcal per Day, or null for no Goal. */
  dailyGoal: number | null;
  /** 1 = Monday, 0 = Sunday. */
  weekStartsOn: WeekStart;
};

export const DEFAULT_SETTINGS: Settings = { dailyGoal: null, weekStartsOn: 1 };

export const MIN_GOAL = 500;
export const MAX_GOAL = 10000;

type SettingsRow = {
  daily_goal_calories: number | null;
  week_starts_on: number;
};

export const toSettings = (row: SettingsRow | null): Settings =>
  row
    ? {
        dailyGoal: row.daily_goal_calories,
        weekStartsOn: row.week_starts_on === 0 ? 0 : 1,
      }
    : DEFAULT_SETTINGS;

const GOAL_ERROR = "Enter a goal between 500 and 10,000 calories";

export function parseGoal(
  text: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!/^[0-9]+$/.test(trimmed)) return { ok: false, error: GOAL_ERROR };
  const value = Number(trimmed);
  return value >= MIN_GOAL && value <= MAX_GOAL
    ? { ok: true, value }
    : { ok: false, error: GOAL_ERROR };
}

export type GoalProgress = {
  /** 0 to 1; stays at 1 once the Goal is passed. */
  fraction: number;
  over: boolean;
  overBy: number;
  remaining: number;
};

// How a Day's total compares with the Goal, or null when there is no Goal.
export function goalProgress(
  total: number,
  goal: number | null,
): GoalProgress | null {
  if (goal === null) return null;
  return {
    fraction: Math.min(1, total / goal),
    over: total > goal,
    overBy: Math.max(0, total - goal),
    remaining: Math.max(0, goal - total),
  };
}
