"use client";

import { Fragment } from "react";

import { SelectionCheck } from "@/components/selection/selection-check";
import { useLongPress } from "@/components/selection/use-long-press";
import { goalProgress } from "@/features/settings/domain";
import { useToggle } from "@/features/toggles/queries";
import { cn } from "@/lib/utils";
import { useAnimatedNumber } from "./animated-number";
import { dailyTotal, formatEntryDetail } from "./domain";
import { useEntryRows } from "./entry-rows";
import { groupByMealTime, mealTimeLabel } from "./meal-time";
import type { Entry } from "./types";

const kcal = (value: number) => value.toLocaleString("en-AU");

// The Day's total in large type. It counts to a new value when an Entry is added, changed or
// removed, but shows another Day's value straight away (spec 019).
export function DailyTotal({
  entries,
  goal = null,
  planned = false,
  dayKey = "",
  placeholder = false,
}: {
  entries: readonly Entry[];
  /** The User's daily Goal in kcal, or none. */
  goal?: number | null;
  /** The Day is ahead of today, so this is what is planned, not what was eaten. */
  planned?: boolean;
  /** Which Day this is: changing it shows the new total at once instead of counting to it. */
  dayKey?: string;
  /** The Day is still loading: the same card, its content hidden, so nothing moves when the real
      total arrives (bug #211). Hidden from assistive technology. */
  placeholder?: boolean;
}) {
  const total = dailyTotal(entries);
  const progress = goalProgress(total, goal);
  const counted = useAnimatedNumber(total, { resetKey: dayKey });
  const finalText = kcal(total);

  return (
    <section
      aria-labelledby={placeholder ? undefined : "daily-total-heading"}
      aria-hidden={placeholder ? true : undefined}
      data-slot={placeholder ? "daily-total-placeholder" : undefined}
      className={cn(
        "relative flex flex-col items-center gap-3 rounded-2xl bg-muted px-4 py-6",
        placeholder && "animate-pulse *:invisible",
      )}
    >
      <h2
        id={placeholder ? undefined : "daily-total-heading"}
        className="sr-only"
      >
        {planned ? "Planned total" : "Daily total"}
      </h2>
      {/* In the card's top padding rather than the flow, so a planned Day's total sits exactly where
          any other Day's does (spec 019). */}
      {planned ? (
        <p
          aria-hidden="true"
          className="absolute top-2 font-medium text-muted-foreground text-xs uppercase tracking-wide"
        >
          Planned
        </p>
      ) : null}
      {/* Screen readers hear only where the number ends up, once, never the count to it. */}
      <p className="sr-only" aria-live={placeholder ? undefined : "polite"}>
        {goal !== null
          ? `${finalText} of ${kcal(goal)} kcal`
          : `${finalText} kcal`}
      </p>
      <p aria-hidden="true" className="flex items-baseline gap-2">
        {/* As wide as the final figure from the first frame, so the Goal and "kcal" beside it stay
            put while the digits count. */}
        <span
          className="text-right font-semibold text-5xl tabular-nums tracking-tight"
          style={{ minWidth: `${finalText.length}ch` }}
        >
          {kcal(counted)}
        </span>{" "}
        {goal !== null ? (
          <span className="text-muted-foreground text-xl tabular-nums">
            / {kcal(goal)}
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
                "h-full rounded-full transition-[width] duration-[400ms] ease-out motion-reduce:transition-none",
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

/** Selection mode (spec 014): holding an Entry starts it, and taps then pick instead of open. */
export type EntrySelection = {
  selecting: boolean;
  isSelected: (id: string) => boolean;
  onStart: (entry: Entry) => void;
  onToggle: (entry: Entry) => void;
};

type Props = {
  entries: readonly Entry[];
  /** When given, each Entry is a button that opens it. */
  onSelect?: (entry: Entry) => void;
  selection?: EntrySelection;
};

function EntryRow({
  entry,
  onSelect,
  selection,
}: {
  entry: Entry;
  onSelect?: (entry: Entry) => void;
  selection?: EntrySelection;
}) {
  const press = useLongPress({
    onLongPress: () =>
      selection?.selecting
        ? selection.onToggle(entry)
        : selection?.onStart(entry),
    onPress: () =>
      selection?.selecting ? selection.onToggle(entry) : onSelect?.(entry),
  });
  const mealTimesOn = useToggle("feature-173");
  const selecting = selection?.selecting ?? false;
  const picked = selecting && selection?.isSelected(entry.id) === true;

  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span className="font-medium">{entry.food.name}</span>
        <span className="text-muted-foreground text-sm">
          {formatEntryDetail(entry)}
          {mealTimesOn && entry.mealTime
            ? ` · ${mealTimeLabel(entry.mealTime)}`
            : ""}
        </span>
      </span>
      {/* At the end, so starting selection never shifts the text (bug #83). */}
      {selecting ? <SelectionCheck picked={picked} /> : null}
    </>
  );

  if (!onSelect && !selection) {
    return (
      <div className="flex min-h-14 flex-col justify-center gap-0.5 py-3">
        <span className="font-medium">{entry.food.name}</span>
        <span className="text-muted-foreground text-sm">
          {formatEntryDetail(entry)}
          {mealTimesOn && entry.mealTime
            ? ` · ${mealTimeLabel(entry.mealTime)}`
            : ""}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selecting ? picked : undefined}
      {...press}
      className={cn(
        "flex min-h-14 w-full select-none items-center gap-3 py-3 text-left [-webkit-touch-callout:none]",
        picked && "bg-muted",
      )}
    >
      {content}
    </button>
  );
}

export function EntryList({ entries, onSelect, selection }: Props) {
  const rows = useEntryRows(entries);
  const mealTimesOn = useToggle("feature-173");

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-muted-foreground">
        Nothing logged yet
      </p>
    );
  }

  // Grouped only when the Toggle is on and some Entry has a Meal time. A leaving row stays in its
  // group while it collapses but no longer counts towards the heading.
  const groups = mealTimesOn
    ? groupByMealTime(
        rows,
        (row) => row.entry.mealTime,
        (row) =>
          row.leaving ? 0 : row.entry.quantity * row.entry.food.calories,
      )
    : [];
  const sections = groups.length
    ? groups.map((group) => ({ group, rows: group.items }))
    : [{ group: null, rows }];

  return (
    <ul aria-label="Entries">
      {sections.map(({ group, rows: sectionRows }) => (
        <Fragment key={group?.key ?? "all"}>
          {group ? (
            <li role="presentation" className="border-b pt-6 pb-1 first:pt-0">
              <h3 className="flex items-baseline justify-between font-semibold text-lg">
                <span>{group.heading}</span>
                <span className="font-normal text-muted-foreground text-sm tabular-nums">
                  {kcal(group.calories)} kcal
                </span>
              </h3>
            </li>
          ) : null}
          {sectionRows.map(({ entry, leaving, animate }) => (
            // A new Entry grows and fades in (it starts collapsed, from `starting:`), and a removed
            // one collapses and fades out, so the rows around it glide into place (spec 019). Rows
            // already on the page when it opened never animate, and a device that asks for reduced
            // motion gets none of it.
            <li
              key={entry.id}
              data-leaving={leaving ? "" : undefined}
              inert={leaving}
              aria-hidden={leaving ? true : undefined}
              className={cn(
                "grid border-b transition-[grid-template-rows,opacity] duration-200 ease-out last:border-b-0 motion-reduce:transition-none",
                leaving
                  ? "grid-rows-[0fr] opacity-0"
                  : "grid-rows-[1fr] opacity-100",
                animate && "starting:grid-rows-[0fr] starting:opacity-0",
              )}
            >
              <div
                className={cn(
                  "min-h-0 overflow-hidden transition-transform duration-200 ease-out motion-reduce:transition-none",
                  animate && "starting:-translate-y-2",
                )}
              >
                {leaving ? (
                  <EntryRow entry={entry} />
                ) : (
                  <EntryRow
                    entry={entry}
                    onSelect={onSelect}
                    selection={selection}
                  />
                )}
              </div>
            </li>
          ))}
        </Fragment>
      ))}
    </ul>
  );
}
