"use client";

import { dailyTotal, formatEntryDetail } from "./domain";
import type { Entry } from "./types";

export function DailyTotal({ entries }: { entries: readonly Entry[] }) {
  return (
    <section
      aria-labelledby="daily-total-heading"
      className="flex flex-col items-center gap-1 rounded-2xl bg-muted px-4 py-6"
    >
      <h2 id="daily-total-heading" className="sr-only">
        Daily total
      </h2>
      <p className="flex items-baseline gap-2" aria-live="polite">
        <span className="font-semibold text-5xl tabular-nums tracking-tight">
          {dailyTotal(entries).toLocaleString("en-AU")}
        </span>
        <span className="text-lg text-muted-foreground">kcal</span>
      </p>
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
