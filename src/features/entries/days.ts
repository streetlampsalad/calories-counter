// A Day is a plain calendar date ("2026-11-03"). It is never converted through a time zone, so
// an Entry made at 11:50 pm stays on that date wherever the server is.

const pad = (n: number) => String(n).padStart(2, "0");

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
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
] as const;

// The device's own calendar date. Reads local parts directly; toISOString would use UTC.
export const localDateString = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Calendar maths in UTC, where there are no daylight saving jumps to trip over.
const toUtcDate = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
};
const fromUtcDate = (date: Date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

const isRealDay = (value: string) =>
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) &&
  fromUtcDate(toUtcDate(value)) === value;

// The Day named by a URL parameter, or today when it is missing, malformed, impossible or in
// the future (ISO dates sort the same as they read).
export function parseDay(
  param: string | string[] | undefined,
  today: string,
): string {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value || !isRealDay(value) || value > today) return today;
  return value;
}

export function shiftDay(day: string, delta: number): string {
  const date = toUtcDate(day);
  date.setUTCDate(date.getUTCDate() + delta);
  return fromUtcDate(date);
}

export function dayLabel(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === shiftDay(today, -1)) return "Yesterday";
  const date = toUtcDate(day);
  const label = `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return date.getUTCFullYear() === toUtcDate(today).getUTCFullYear()
    ? label
    : `${label} ${date.getUTCFullYear()}`;
}

// 0 = Sunday ... 6 = Saturday
export const dayOfWeek = (day: string) => toUtcDate(day).getUTCDay();

// Every date from `from` to `to`, inclusive; empty if `to` is before `from`.
export function listDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = shiftDay(day, 1)) days.push(day);
  return days;
}

export const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
