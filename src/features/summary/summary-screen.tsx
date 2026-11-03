"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToday } from "@/features/entries/use-today";
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
import { useDailyTotals } from "./queries";
import { summarise } from "./summarise";
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
}: {
  period: PeriodId;
  today: string;
  weekStartsOn: 0 | 1;
  goal: number | null;
}) {
  const range = periodRange(period, today, weekStartsOn);
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
  const { weekStartsOn, dailyGoal } = settings ?? DEFAULT_SETTINGS;

  return (
    <main className="flex flex-1 flex-col gap-4">
      <h1 className="font-semibold text-2xl tracking-tight">Summary</h1>
      <PeriodChips selected={period} />
      <h2 className="sr-only">{label}</h2>

      {ready ? (
        <PeriodContent
          period={period}
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
