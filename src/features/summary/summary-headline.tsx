import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Summary } from "./summarise";

const number = (value: number) => value.toLocaleString("en-AU");
const plural = (count: number, word: string) =>
  `${word}${count === 1 ? "" : "s"}`;

function goalLine(averageVsGoal: number) {
  if (averageVsGoal === 0) return "Right on your goal on average";
  const amount = number(Math.abs(averageVsGoal));
  return averageVsGoal < 0
    ? `${amount} kcal under goal on average`
    : `${amount} kcal over goal on average`;
}

// The main information up front: the total, the average over days actually logged, and how many
// days that was. With a Goal, how the average compares and how many days went over.
export function SummaryHeadline({
  summary,
  goal,
}: {
  summary: Summary;
  goal: number | null;
}) {
  if (summary.loggedDays === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted px-4 py-10 text-center">
        <p className="font-medium">Nothing logged in this period</p>
        <p className="text-muted-foreground text-sm">
          Log what you eat and it will show up here.
        </p>
        <Button render={<Link href="/" />} className="h-12 px-6 text-base">
          Go to Today
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="summary-totals-heading"
      className="flex flex-col items-center gap-2 rounded-2xl bg-muted px-4 py-6 text-center"
    >
      <h2 id="summary-totals-heading" className="sr-only">
        Summary totals
      </h2>
      <p className="flex items-baseline gap-2">
        <span className="font-semibold text-5xl tabular-nums tracking-tight">
          {number(summary.total)}
        </span>{" "}
        <span className="text-lg text-muted-foreground">kcal total</span>
      </p>

      {summary.averagePerLoggedDay !== null ? (
        <p className="text-lg">
          Average{" "}
          <span className="font-semibold tabular-nums">
            {number(summary.averagePerLoggedDay)}
          </span>{" "}
          kcal per logged day
        </p>
      ) : null}

      <p className="text-muted-foreground text-sm">
        {summary.loggedDays} of {summary.daysInRange}{" "}
        {plural(summary.daysInRange, "day")} logged
      </p>

      {goal !== null && summary.averageVsGoal !== null ? (
        <div className="mt-1 flex flex-col gap-0.5 border-t pt-3 text-sm">
          <p className="font-medium">{goalLine(summary.averageVsGoal)}</p>
          <p className="text-muted-foreground">
            Over goal on {summary.overGoalDays} of {summary.loggedDays} logged{" "}
            {plural(summary.loggedDays, "day")}
          </p>
        </div>
      ) : null}
    </section>
  );
}
