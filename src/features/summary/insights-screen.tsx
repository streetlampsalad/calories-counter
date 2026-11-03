"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToday } from "@/features/entries/use-today";
import { DEFAULT_SETTINGS } from "@/features/settings/domain";
import { useSettings } from "@/features/settings/queries";
import { GoalCard, StreakCard } from "./consistency-cards";
import { DayOfWeekCard } from "./day-of-week-card";
import {
  formatRange,
  INSIGHT_RANGES,
  type InsightsRangeId,
  insightsRange,
  parseInsightsRange,
} from "./period";
import { PeriodChips } from "./period-chips";
import { useDailyTotals } from "./queries";
import { historyRange } from "./streaks";
import { TopFoodsCard } from "./top-foods-card";
import { TrendCard } from "./trend-card";

function Skeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

function InsightsContent({
  rangeId,
  today,
  weekStartsOn,
  goal,
}: {
  rangeId: InsightsRangeId;
  today: string;
  weekStartsOn: 0 | 1;
  goal: number | null;
}) {
  const range = insightsRange(rangeId, today, weekStartsOn);
  const { data: totals, isPending, isError, refetch } = useDailyTotals(range);
  // Streaks reach back past the Period, so they read their own, longer, window.
  const history = useDailyTotals(historyRange(today));

  return (
    <>
      <p className="text-muted-foreground text-sm">{formatRange(range)}</p>

      {isPending ? <Skeleton /> : null}

      {isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border p-4"
        >
          <p>Couldn't load your insights.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {totals ? (
        <div className="flex flex-col gap-4">
          <TrendCard totals={totals} range={range} goal={goal} today={today} />
          <TopFoodsCard range={range} />
          <DayOfWeekCard
            totals={totals}
            range={range}
            weekStartsOn={weekStartsOn}
          />
          {history.data ? (
            <>
              {goal !== null ? (
                <GoalCard
                  totals={totals}
                  history={history.data}
                  range={range}
                  goal={goal}
                  today={today}
                />
              ) : null}
              <StreakCard history={history.data} today={today} />
            </>
          ) : history.isError ? (
            <div
              role="alert"
              className="flex flex-col items-start gap-3 rounded-2xl border p-4"
            >
              <p>Couldn't load your streaks.</p>
              <Button variant="outline" onClick={() => history.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <Skeleton />
          )}
        </div>
      ) : null}
    </>
  );
}

export function InsightsScreen() {
  const today = useToday();
  const params = useSearchParams();
  const { data: settings, isPending: settingsPending } = useSettings();
  const rangeId = parseInsightsRange(params.get("range") ?? undefined);

  const ready = today !== null && !settingsPending;
  const { weekStartsOn, dailyGoal } = settings ?? DEFAULT_SETTINGS;

  return (
    <main className="flex flex-1 flex-col gap-4">
      <Link
        href={`/summary?period=${INSIGHT_RANGES.slice(0, 5).some((r) => r.id === rangeId) ? rangeId : "this-week"}`}
        className="flex min-h-11 w-fit items-center gap-1.5 text-muted-foreground text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Summary
      </Link>
      <h1 className="font-semibold text-2xl tracking-tight">Insights</h1>
      <PeriodChips
        selected={rangeId}
        options={INSIGHT_RANGES}
        hrefFor={(id) => `/summary/insights?range=${id}`}
      />

      {ready ? (
        <InsightsContent
          rangeId={rangeId}
          today={today}
          weekStartsOn={weekStartsOn}
          goal={dailyGoal}
        />
      ) : (
        <Skeleton />
      )}
    </main>
  );
}
