"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToday } from "@/features/entries/use-today";
import { DEFAULT_SETTINGS } from "@/features/settings/domain";
import { useSettings } from "@/features/settings/queries";
import {
  formatRange,
  INSIGHT_RANGES,
  type InsightsRangeId,
  insightsRange,
  parseInsightsRange,
} from "./period";
import { PeriodChips } from "./period-chips";
import { useDailyTotals } from "./queries";
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
