import type { PeriodRange } from "./period";
import {
  currentStreak,
  goalSplit,
  HISTORY_DAYS,
  longestStreak,
  underGoalRun,
} from "./streaks";
import type { DayTotal } from "./summarise";

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;

// How the Period went against the Goal, and how long the current good run is. Only shown with a Goal.
export function GoalCard({
  totals,
  history,
  range,
  goal,
  today,
}: {
  totals: readonly DayTotal[];
  /** Recent history, which can reach back before the Period, for the current run. */
  history: readonly DayTotal[];
  range: PeriodRange;
  goal: number;
  today: string;
}) {
  const split = goalSplit(totals, range, goal);

  if (split.loggedDays === 0) {
    return (
      <section
        aria-labelledby="goal-heading"
        className="flex flex-col gap-2 rounded-2xl border p-4"
      >
        <h2 id="goal-heading" className="font-medium text-lg">
          Goal
        </h2>
        <p className="font-medium">Not enough data yet</p>
        <p className="text-muted-foreground text-sm">
          No logged days in this period.
        </p>
      </section>
    );
  }

  const run = underGoalRun(history, today, goal);

  return (
    <section
      aria-labelledby="goal-heading"
      className="flex flex-col gap-3 rounded-2xl border p-4"
    >
      <h2 id="goal-heading" className="font-medium text-lg">
        Goal
      </h2>
      <p className="font-medium">
        {days(split.under)} under goal, {days(split.over)} over goal
      </p>
      <p className="text-muted-foreground text-sm">
        {run > 0
          ? `${days(run)} in a row under goal`
          : "No run under goal right now"}
      </p>
    </section>
  );
}

// How consistently the User logs: the run that is on now, and the best so far.
export function StreakCard({
  history,
  today,
}: {
  history: readonly DayTotal[];
  today: string;
}) {
  const current = currentStreak(history, today);
  const longest = longestStreak(history);

  if (longest === 0) {
    return (
      <section
        aria-labelledby="streak-heading"
        className="flex flex-col gap-2 rounded-2xl border p-4"
      >
        <h2 id="streak-heading" className="font-medium text-lg">
          Logging streak
        </h2>
        <p className="font-medium">No streak yet</p>
        <p className="text-muted-foreground text-sm">
          Log what you ate today to start one.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="streak-heading"
      className="flex flex-col gap-3 rounded-2xl border p-4"
    >
      <h2 id="streak-heading" className="font-medium text-lg">
        Logging streak
      </h2>
      <p className="sr-only">
        {`Current streak ${days(current)}, longest streak ${days(longest)}`}
      </p>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-semibold text-3xl tabular-nums">{days(current)}</p>
          <p className="text-muted-foreground text-sm">Current streak</p>
        </div>
        <div>
          <p className="font-semibold text-3xl tabular-nums">{days(longest)}</p>
          <p className="text-muted-foreground text-sm">Longest streak</p>
        </div>
      </div>
      {current === 0 ? (
        <p className="text-muted-foreground text-sm">
          No current streak. Log what you ate today to start a new one.
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Looks back {HISTORY_DAYS} days.
      </p>
    </section>
  );
}
