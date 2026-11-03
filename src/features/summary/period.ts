import {
  dayOfWeek,
  listDays,
  monthStart,
  shiftDay,
} from "@/features/entries/days";
import type { WeekStart } from "@/features/settings/domain";

export const PERIODS = [
  { id: "this-week", label: "This week" },
  { id: "last-week", label: "Last week" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "last-30-days", label: "Last 30 days" },
] as const;

export type PeriodId = (typeof PERIODS)[number]["id"];

export type PeriodRange = {
  from: string;
  to: string;
  /** Every Day from `from` to `to`, in order. */
  days: string[];
};

export const DEFAULT_PERIOD: PeriodId = "this-week";

// The Period named by a URL parameter, or This week for anything unrecognised.
export function parsePeriod(param: string | string[] | undefined): PeriodId {
  const value = Array.isArray(param) ? param[0] : param;
  return PERIODS.find((period) => period.id === value)?.id ?? DEFAULT_PERIOD;
}

const range = (from: string, to: string): PeriodRange => ({
  from,
  to,
  days: listDays(from, to),
});

// The first day of the week `today` is in, given which day weeks start on.
const weekStart = (today: string, weekStartsOn: WeekStart) =>
  shiftDay(today, -((dayOfWeek(today) - weekStartsOn + 7) % 7));

// The Days a Period covers. "This" Periods stop at today; no Period ever includes a future Day.
export function periodRange(
  period: PeriodId,
  today: string,
  weekStartsOn: WeekStart,
): PeriodRange {
  switch (period) {
    case "this-week":
      return range(weekStart(today, weekStartsOn), today);
    case "last-week": {
      const start = shiftDay(weekStart(today, weekStartsOn), -7);
      return range(start, shiftDay(start, 6));
    }
    case "this-month":
      return range(monthStart(today), today);
    case "last-month": {
      const lastDayOfPrevious = shiftDay(monthStart(today), -1);
      return range(monthStart(lastDayOfPrevious), lastDayOfPrevious);
    }
    case "last-30-days":
      return range(shiftDay(today, -29), today);
  }
}

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

const parts = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return { year, month: MONTHS[month - 1], date };
};

// "26 Oct – 1 Nov", "1 – 3 Nov", "3 Nov", or with years when the range spans two.
export function formatRange({ from, to }: PeriodRange): string {
  if (from === to) {
    const day = parts(from);
    return `${day.date} ${day.month}`;
  }
  const start = parts(from);
  const end = parts(to);
  if (start.year !== end.year) {
    return `${start.date} ${start.month} ${start.year} – ${end.date} ${end.month} ${end.year}`;
  }
  if (start.month === end.month)
    return `${start.date} – ${end.date} ${end.month}`;
  return `${start.date} ${start.month} – ${end.date} ${end.month}`;
}
