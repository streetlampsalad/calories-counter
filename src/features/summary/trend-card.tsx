"use client";

import { useState } from "react";
import { dayLabel } from "@/features/entries/days";
import type { PeriodRange } from "./period";
import type { DayTotal } from "./summarise";
import {
  buildTrend,
  hasEnoughData,
  MIN_LOGGED_DAYS,
  rollingAverage,
  trendHeadline,
} from "./trend";

const number = (value: number) => value.toLocaleString("en-AU");

type Props = {
  totals: readonly DayTotal[];
  range: PeriodRange;
  goal: number | null;
  today: string;
};

function loggedIn(totals: readonly DayTotal[], range: PeriodRange) {
  const days = new Set(range.days);
  return totals.filter((t) => t.entryCount > 0 && days.has(t.day)).length;
}

// Is the 7-day average going up or down? A line of the average over logged Days, in words first.
export function TrendCard({ totals, range, goal, today }: Props) {
  const [pointed, setPointed] = useState<number | null>(null);

  if (!hasEnoughData(totals, range)) {
    return (
      <section
        aria-labelledby="trend-heading"
        className="flex flex-col gap-2 rounded-2xl border p-4"
      >
        <h2 id="trend-heading" className="font-medium text-lg">
          Trend
        </h2>
        <p className="font-medium">Not enough data yet</p>
        <p className="text-muted-foreground text-sm">
          A trend needs at least {MIN_LOGGED_DAYS} logged days.{" "}
          {loggedIn(totals, range)} of {MIN_LOGGED_DAYS} days logged so far.
        </p>
      </section>
    );
  }

  const points = rollingAverage(totals, range);
  const trend = buildTrend(points, goal);
  const headline = trendHeadline(points);

  function pointAt(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return;
    const fraction = Math.min(
      1,
      Math.max(0, (event.clientX - box.left) / box.width),
    );
    const index = Math.round(fraction * (points.length - 1));
    setPointed(points[index]?.average === null ? null : index);
  }

  const active = pointed === null ? null : points[pointed];

  return (
    <section
      aria-labelledby="trend-heading"
      className="flex flex-col gap-3 rounded-2xl border p-4"
    >
      <h2 id="trend-heading" className="font-medium text-lg">
        Trend
      </h2>
      {headline ? <p className="font-medium">{headline}</p> : null}

      <p
        data-testid="trend-detail"
        aria-live="polite"
        className="min-h-5 text-muted-foreground text-sm"
      >
        {active && active.average !== null
          ? `${dayLabel(active.day, today)}: 7-day average ${number(active.average)} kcal`
          : "Touch or point at the line to see a day"}
      </p>

      <div
        data-testid="trend-line"
        className="relative h-36 touch-pan-y"
        onPointerMove={pointAt}
        onPointerDown={pointAt}
        onPointerLeave={() => setPointed(null)}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="size-full overflow-visible text-primary"
        >
          {trend.segments.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {trend.goalPct !== null && goal !== null ? (
          <div
            data-testid="trend-goal"
            className="pointer-events-none absolute inset-x-0 border-foreground/60 border-t-2 border-dashed"
            style={{ bottom: `${trend.goalPct}%` }}
          >
            <span className="absolute left-0 bottom-1 rounded bg-background/80 px-1 text-muted-foreground text-xs">
              Goal {number(goal)}
            </span>
          </div>
        ) : null}

        {trend.last ? (
          <span
            data-testid="trend-last"
            className="pointer-events-none absolute right-0 -translate-y-1/2 rounded bg-background/80 px-1 font-medium text-sm tabular-nums"
            style={{ bottom: `${trend.last.pct}%` }}
          >
            {number(trend.last.average)}
          </span>
        ) : null}

        {active ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 border-foreground/30 border-l"
            style={{
              left: `${((pointed ?? 0) / Math.max(1, points.length - 1)) * 100}%`,
            }}
          />
        ) : null}
      </div>

      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-3 text-muted-foreground">
          View as a table
        </summary>
        <table aria-label="7-day average by day" className="w-full text-left">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="py-2 font-medium">
                Day
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                7-day average
              </th>
            </tr>
          </thead>
          <tbody>
            {points.flatMap((point) =>
              point.average === null
                ? []
                : [
                    <tr key={point.day} className="border-b last:border-b-0">
                      <th scope="row" className="py-2 font-normal">
                        {dayLabel(point.day, today)}
                      </th>
                      <td className="py-2 text-right tabular-nums">
                        {number(point.average)}
                      </td>
                    </tr>,
                  ],
            )}
          </tbody>
        </table>
      </details>
    </section>
  );
}
