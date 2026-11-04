"use client";

import { goalProgress } from "@/features/settings/domain";
import { cn } from "@/lib/utils";
import { dailyTotal, formatEntryDetail } from "./domain";
import type { Entry } from "./types";

export function DailyTotal({
  entries,
  goal = null,
  planned = false,
}: {
  entries: readonly Entry[];
  /** The User's daily Goal in kcal, or none. */
  goal?: number | null;
  /** The Day is ahead of today, so this is what is planned, not what was eaten. */
  planned?: boolean;
}) {
  const total = dailyTotal(entries);
  const progress = goalProgress(total, goal);

  return (
    <section
      aria-labelledby="daily-total-heading"
      className="flex flex-col items-center gap-3 rounded-2xl bg-muted px-4 py-6"
    >
      <h2 id="daily-total-heading" className="sr-only">
        {planned ? "Planned total" : "Daily total"}
      </h2>
      {planned ? (
        <p
          aria-hidden="true"
          className="font-medium text-muted-foreground text-sm uppercase tracking-wide"
        >
          Planned
        </p>
      ) : null}
      <p className="flex items-baseline gap-2" aria-live="polite">
        <span className="font-semibold text-5xl tabular-nums tracking-tight">
          {total.toLocaleString("en-AU")}
        </span>{" "}
        {goal !== null ? (
          <span className="text-muted-foreground text-xl tabular-nums">
            / {goal.toLocaleString("en-AU")}
          </span>
        ) : null}{" "}
        <span className="text-lg text-muted-foreground">kcal</span>
      </p>

      {progress && goal !== null ? (
        <>
          <div
            role="progressbar"
            aria-label="Progress towards your daily goal"
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={Math.min(total, goal)}
            className="h-2.5 w-full overflow-hidden rounded-full bg-background"
          >
            <div
              data-over={progress.over ? "" : undefined}
              style={{ width: `${progress.fraction * 100}%` }}
              className={cn(
                "h-full rounded-full transition-[width]",
                progress.over ? "bg-destructive" : "bg-primary",
              )}
            />
          </div>
          <p
            className={cn(
              "font-medium text-sm tabular-nums",
              progress.over ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {progress.over
              ? `${progress.overBy.toLocaleString("en-AU")} over`
              : `${progress.remaining.toLocaleString("en-AU")} left`}
          </p>
        </>
      ) : null}
    </section>
  );
}

type Props = {
  entries: readonly Entry[];
  /** When given, each Entry is a button that opens it. */
  onSelect?: (entry: Entry) => void;
};

export function EntryList({ entries, onSelect }: Props) {
  if (entries.length === 0) {
    return (
      <p className="py-10 text-center text-muted-foreground">
        Nothing logged yet
      </p>
    );
  }

  return (
    <ul aria-label="Entries">
      {entries.map((entry) => {
        const content = (
          <>
            <span className="font-medium">{entry.food.name}</span>
            <span className="text-muted-foreground text-sm">
              {formatEntryDetail(entry)}
            </span>
          </>
        );
        return (
          <li key={entry.id} className="border-b last:border-b-0">
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(entry)}
                className="flex min-h-14 w-full flex-col items-start justify-center gap-0.5 py-3 text-left"
              >
                {content}
              </button>
            ) : (
              <div className="flex min-h-14 flex-col justify-center gap-0.5 py-3">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
