export type WeekStart = 0 | 1;

// A User with no saved settings has these. Nothing is created at sign-up.
export type Settings = {
  /** Whole kcal per Day, or null for no Goal. */
  dailyGoal: number | null;
  /** 1 = Monday, 0 = Sunday. */
  weekStartsOn: WeekStart;
  /** The daily Reminder is on, for every device the User has turned it on from (spec 016). */
  reminderEnabled: boolean;
  /** When the Reminder is due on the User's own clock: "HH:MM", on a quarter hour. */
  reminderTime: string;
  /** The IANA name of the device's time zone when the Reminder was last set, or null. */
  timeZone: string | null;
};

export const DEFAULT_REMINDER_TIME = "19:00";

export const DEFAULT_SETTINGS: Settings = {
  dailyGoal: null,
  weekStartsOn: 1,
  reminderEnabled: false,
  reminderTime: DEFAULT_REMINDER_TIME,
  timeZone: null,
};

export const MIN_GOAL = 500;
export const MAX_GOAL = 10000;

type SettingsRow = {
  daily_goal_calories: number | null;
  week_starts_on: number;
  reminder_enabled: boolean;
  /** Postgres writes a time as "19:00:00". */
  reminder_time: string;
  time_zone: string | null;
};

export const toSettings = (row: SettingsRow | null): Settings =>
  row
    ? {
        dailyGoal: row.daily_goal_calories,
        weekStartsOn: row.week_starts_on === 0 ? 0 : 1,
        reminderEnabled: row.reminder_enabled,
        reminderTime: row.reminder_time.slice(0, 5),
        timeZone: row.time_zone,
      }
    : DEFAULT_SETTINGS;

// The Reminder goes out in 15-minute steps, so a time typed between steps goes back to the one
// before it (07:50 becomes 07:45). Returns null for anything that is not a time of day.
export function toQuarterHour(text: string): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(text);
  if (!match) return null;
  const minutes = Math.floor(Number(match[2]) / 15) * 15;
  return `${match[1]}:${String(minutes).padStart(2, "0")}`;
}

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
