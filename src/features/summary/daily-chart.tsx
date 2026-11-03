"use client";

import Link from "next/link";
import { useState } from "react";
import { dayHref, dayLabel } from "@/features/entries/days";
import { cn } from "@/lib/utils";
import { axisLabels, type Bar, buildBars } from "./chart-data";
import type { PeriodRange } from "./period";
import type { DayTotal } from "./summarise";

const number = (value: number) => value.toLocaleString("en-AU");

// A diagonal texture over the over-Goal bars, so they differ by more than colour.
const OVER_TEXTURE =
  "repeating-linear-gradient(135deg, transparent 0 3px, rgba(255,255,255,0.55) 3px 5px)";

// Past this many Days the columns get a minimum width and the chart scrolls sideways, so each
// Day stays something a thumb can hit.
const SCROLL_AFTER_DAYS = 14;
const MIN_COLUMN_PX = 18;

function describeDay(bar: Bar, today: string, goal: number | null): string {
  const label = dayLabel(bar.day, today);
  if (bar.calories === null) return `${label}: nothing logged`;
  const base = `${label}: ${number(bar.calories)} kcal`;
  return goal !== null && bar.over
    ? `${base}, ${number(bar.calories - goal)} over goal`
    : base;
}

function againstGoal(bar: Bar, goal: number): string {
  if (bar.calories === null) return "";
  const difference = bar.calories - goal;
  if (difference === 0) return "On goal";
  return difference > 0
    ? `${number(difference)} over`
    : `${number(-difference)} under`;
}

function Key() {
  return (
    <ul
      aria-label="Key"
      className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs"
    >
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-sm bg-primary" />{" "}
        Calories
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="w-4 border-foreground/60 border-t-2 border-dashed"
        />{" "}
        Goal
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-2.5 rounded-sm bg-destructive"
          style={{ backgroundImage: OVER_TEXTURE }}
        />{" "}
        Over goal
      </li>
    </ul>
  );
}

type Props = {
  totals: readonly DayTotal[];
  range: PeriodRange;
  goal: number | null;
  today: string;
};

// One bar per Day of the Period. Each is a link to that Day, so it can be reached by tap, mouse
// or keyboard, and a table below carries the same numbers as plain text.
export function DailyChart({ totals, range, goal, today }: Props) {
  const { bars, goalPct } = buildBars(totals, range, goal);
  const labels = axisLabels(range.days);
  const [active, setActive] = useState<Bar | null>(null);
  const scrolls = bars.length > SCROLL_AFTER_DAYS;
  const width = scrolls ? { minWidth: bars.length * MIN_COLUMN_PX } : undefined;

  return (
    <section
      aria-labelledby="daily-chart-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="daily-chart-heading" className="font-medium text-lg">
        Day by day
      </h2>

      <p
        data-testid="detail"
        aria-live="polite"
        className="min-h-5 text-muted-foreground text-sm"
      >
        {active ? describeDay(active, today, goal) : "Tap a day to open it"}
      </p>

      <div className="-mx-4 overflow-x-auto px-4">
        <div style={width}>
          <div className="relative h-40">
            <ul
              aria-label="Daily calories"
              className="flex h-full items-end gap-0.5 border-b"
              onMouseLeave={() => setActive(null)}
            >
              {bars.map((bar) => (
                <li key={bar.day} className="h-full min-w-0 flex-1">
                  <Link
                    href={dayHref(bar.day, today)}
                    aria-label={describeDay(bar, today, goal)}
                    onMouseEnter={() => setActive(bar)}
                    onFocus={() => setActive(bar)}
                    onBlur={() => setActive(null)}
                    className="flex h-full items-end justify-center rounded-sm outline-offset-2"
                  >
                    {bar.logged ? (
                      <span
                        data-testid="bar"
                        data-over={bar.over ? "" : undefined}
                        style={{
                          height: `${bar.heightPct}%`,
                          backgroundImage: bar.over ? OVER_TEXTURE : undefined,
                        }}
                        className={cn(
                          "w-full max-w-5 rounded-t-[4px]",
                          bar.over ? "bg-destructive" : "bg-primary",
                        )}
                      />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>

            {goalPct !== null && goal !== null ? (
              <div
                data-testid="goal-line"
                className="pointer-events-none absolute inset-x-0 border-foreground/60 border-t-2 border-dashed"
                style={{ bottom: `${goalPct}%` }}
              >
                <span className="absolute right-0 bottom-1 rounded bg-background/80 px-1 text-muted-foreground text-xs">
                  Goal {number(goal)}
                </span>
              </div>
            ) : null}
          </div>

          <div
            data-testid="axis"
            aria-hidden="true"
            className="mt-1 flex gap-0.5"
          >
            {labels.map((label, i) => (
              <span
                key={range.days[i]}
                className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-muted-foreground text-xs"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {goal !== null ? <Key /> : null}

      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-3 text-muted-foreground">
          View as a table
        </summary>
        <table aria-label="Daily calories" className="w-full text-left">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="py-2 font-medium">
                Day
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Calories
              </th>
              {goal !== null ? (
                <th scope="col" className="py-2 text-right font-medium">
                  Against goal
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.day} className="border-b last:border-b-0">
                <th scope="row" className="py-2 font-normal">
                  {dayLabel(bar.day, today)}
                </th>
                <td className="py-2 text-right tabular-nums">
                  {bar.calories === null ? "Not logged" : number(bar.calories)}
                </td>
                {goal !== null ? (
                  <td className="py-2 text-right tabular-nums">
                    {againstGoal(bar, goal)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
