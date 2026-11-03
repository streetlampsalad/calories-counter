import type { WeekStart } from "@/features/settings/domain";
import {
  busiestWeekday,
  dayOfWeekAverages,
  dayOfWeekHeadline,
  hasEnoughWeekdayData,
  MIN_LOGGED_DAYS_FOR_WEEKDAYS,
} from "./day-of-week";
import type { PeriodRange } from "./period";
import type { DayTotal } from "./summarise";

const number = (value: number) => value.toLocaleString("en-AU");

function loggedIn(totals: readonly DayTotal[], range: PeriodRange) {
  const days = new Set(range.days);
  return totals.filter((t) => t.entryCount > 0 && days.has(t.day)).length;
}

// Which weekdays run high? Seven bars from the User's week start, the highest named in words.
export function DayOfWeekCard({
  totals,
  range,
  weekStartsOn,
}: {
  totals: readonly DayTotal[];
  range: PeriodRange;
  weekStartsOn: WeekStart;
}) {
  if (!hasEnoughWeekdayData(totals, range)) {
    return (
      <section
        aria-labelledby="day-of-week-heading"
        className="flex flex-col gap-2 rounded-2xl border p-4"
      >
        <h2 id="day-of-week-heading" className="font-medium text-lg">
          Day of week
        </h2>
        <p className="font-medium">Not enough data yet</p>
        <p className="text-muted-foreground text-sm">
          Weekday averages need at least {MIN_LOGGED_DAYS_FOR_WEEKDAYS} logged
          days. {loggedIn(totals, range)} of {MIN_LOGGED_DAYS_FOR_WEEKDAYS} days
          logged so far.
        </p>
      </section>
    );
  }

  const averages = dayOfWeekAverages(totals, range, weekStartsOn);
  const headline = dayOfWeekHeadline(averages);
  const busiest = busiestWeekday(averages);
  const highest = Math.max(...averages.map((entry) => entry.average ?? 0), 1);

  return (
    <section
      aria-labelledby="day-of-week-heading"
      className="flex flex-col gap-3 rounded-2xl border p-4"
    >
      <h2 id="day-of-week-heading" className="font-medium text-lg">
        Day of week
      </h2>
      {headline ? <p className="font-medium">{headline}</p> : null}

      <ul aria-label="Average by weekday" className="flex flex-col gap-2">
        {averages.map((entry) => (
          <li
            key={entry.weekday}
            className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3"
          >
            <span className="text-muted-foreground text-sm">{entry.short}</span>
            <span
              aria-hidden="true"
              className="h-3 overflow-hidden rounded-full bg-muted"
            >
              {entry.average !== null ? (
                <span
                  className={
                    entry.weekday === busiest?.weekday
                      ? "block h-full rounded-full bg-primary"
                      : "block h-full rounded-full bg-primary/50"
                  }
                  style={{ width: `${(entry.average / highest) * 100}%` }}
                />
              ) : null}
            </span>
            <span className="text-right text-sm tabular-nums">
              {entry.average === null ? (
                <span className="text-muted-foreground">Not logged</span>
              ) : (
                <>
                  <span className="font-medium">
                    {number(entry.average)} kcal
                  </span>
                  {entry.weekday === busiest?.weekday ? (
                    <span className="ml-2 text-muted-foreground text-xs">
                      Highest
                    </span>
                  ) : null}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
