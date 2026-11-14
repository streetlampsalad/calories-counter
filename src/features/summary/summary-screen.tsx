"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { summariseDeficit } from "@/features/burned/domain";
import { useToday } from "@/features/entries/use-today";
import { TipsCard } from "@/features/nutrition-tips/tips-card";
import { DEFAULT_SETTINGS } from "@/features/settings/domain";
import { useSettings } from "@/features/settings/queries";
import { DailyChart } from "./daily-chart";
import {
  formatRange,
  PERIODS,
  type PeriodId,
  parsePeriod,
  periodRange,
} from "./period";
import { PeriodChips } from "./period-chips";
import { usePeriodDays } from "./queries";
import { type DayTotal, summarise } from "./summarise";
import { SummaryHeadline } from "./summary-headline";

function Skeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="h-36 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

function PeriodContent({
  period,
  today,
  weekStartsOn,
  goal,
  trackCaloriesBurned,
}: {
  period: PeriodId;
  today: string;
  weekStartsOn: 0 | 1;
  goal: number | null;
  trackCaloriesBurned: boolean;
}) {
  const range = periodRange(period, today, weekStartsOn);
  const { data: days, isPending, isError, refetch } = usePeriodDays(range);
  // The headline and chart count logged Days only; a Day with just Calories Burned is not one.
  const totals = days?.flatMap((day): DayTotal[] =>
    day.calories !== null && day.entryCount > 0
      ? [{ day: day.day, calories: day.calories, entryCount: day.entryCount }]
      : [],
  );

  return (
    <>
      <p className="text-muted-foreground text-sm">{formatRange(range)}</p>

      {isPending ? <Skeleton /> : null}

      {isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border p-4"
        >
          <p>Couldn't load this summary.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {totals ? (
        <>
          <SummaryHeadline
            summary={summarise(totals, range, goal)}
            goal={goal}
            deficit={
              trackCaloriesBurned && days ? summariseDeficit(days, today) : null
            }
          />
          {totals.some((total) => total.entryCount > 0) ? (
            <DailyChart
              totals={totals}
              range={range}
              goal={goal}
              today={today}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}

export function SummaryScreen() {
  const today = useToday();
  const params = useSearchParams();
  const { data: settings, isPending: settingsPending } = useSettings();
  const period = parsePeriod(params.get("period") ?? undefined);
  const label = PERIODS.find((p) => p.id === period)?.label;

  // The Period's Days depend on the week start, so wait for it rather than show one range then another.
  const ready = today !== null && !settingsPending;
  const { weekStartsOn, dailyGoal, trackCaloriesBurned } =
    settings ?? DEFAULT_SETTINGS;

  return (
    <main className="flex flex-1 flex-col gap-4">
      <h1 className="font-semibold text-2xl tracking-tight">Summary</h1>
      <PeriodChips selected={period} />
      <h2 className="sr-only">{label}</h2>
      <Link
        href={`/summary/insights?range=${period}`}
        className="flex min-h-11 w-fit items-center gap-1 font-medium text-sm"
      >
        See insights <ChevronRight aria-hidden="true" className="size-4" />
      </Link>

      {ready ? (
        <PeriodContent
          period={period}
          today={today}
          weekStartsOn={weekStartsOn}
          goal={dailyGoal}
          trackCaloriesBurned={trackCaloriesBurned}
        />
      ) : (
        <Skeleton />
      )}

      {ready ? <TipsCard today={today} weekStartsOn={weekStartsOn} /> : null}
    </main>
  );
}
