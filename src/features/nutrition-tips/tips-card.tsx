"use client";

import { Button } from "@/components/ui/button";
import type { WeekStart } from "@/features/settings/domain";
import { formatRange } from "@/features/summary/period";
import { useDailyTotals } from "@/features/summary/queries";
import { TipsError, useGetTips } from "./queries";
import { hasEnoughDays, lastWeek } from "./week";

const MESSAGES: Record<string, string> = {
  limit_reached: "You can get tips 3 times a day. Try again tomorrow.",
  tips_unavailable: "Tips aren't available right now. Try again later.",
};

// Nutrition tips for last week (spec 219), whichever Period is chosen. Only rendered while the
// Toggle feature-218 is on.
export function TipsCard({
  today,
  weekStartsOn,
}: {
  today: string;
  weekStartsOn: WeekStart;
}) {
  const range = lastWeek(today, weekStartsOn);
  const daily = useDailyTotals(range);
  const totals = daily.data;
  const getTips = useGetTips(range.from);

  const code =
    getTips.error instanceof TipsError ? getTips.error.code : "tips_failed";
  const message = getTips.isError
    ? (MESSAGES[code] ?? "Couldn't get tips.")
    : null;
  const failed = getTips.isError && !(code in MESSAGES);
  const limited = getTips.isError && code === "limit_reached";

  return (
    <section
      aria-labelledby="nutrition-tips-heading"
      className="flex flex-col gap-3 rounded-2xl border p-4"
    >
      <h2 id="nutrition-tips-heading" className="font-medium text-lg">
        Nutrition tips
      </h2>
      <p className="text-muted-foreground text-sm">{formatRange(range)}</p>

      {getTips.data ? (
        <>
          <ul className="flex flex-col gap-2">
            {getTips.data.map((tip, i) => (
              <li key={`${i}-${tip.nutrient}`}>
                <strong>{tip.nutrient}</strong>: {tip.tip}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm">
            AI guesses from your food names, not medical or dietary advice.
          </p>
        </>
      ) : totals && !hasEnoughDays(totals) ? (
        <p>Log food on at least 3 days in a week to get tips.</p>
      ) : totals ? (
        <>
          {message ? <p role="alert">{message}</p> : null}
          {limited ? null : (
            <Button
              className="min-h-11 self-start"
              disabled={getTips.isPending}
              aria-busy={getTips.isPending}
              onClick={() => getTips.mutate()}
            >
              {getTips.isPending
                ? "Getting tips…"
                : failed
                  ? "Try again"
                  : "Get tips"}
            </Button>
          )}
        </>
      ) : daily.isError ? (
        <>
          <p role="alert">Couldn't load last week.</p>
          <Button
            className="min-h-11 self-start"
            variant="outline"
            onClick={() => daily.refetch()}
          >
            Try again
          </Button>
        </>
      ) : null}
    </section>
  );
}
