"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PeriodRange } from "./period";
import { useFoodTotals } from "./queries";
import { type TopBy, topFoods } from "./top-foods";

const number = (value: number) => value.toLocaleString("en-AU");

const CHOICES: ReadonlyArray<{ by: TopBy; label: string }> = [
  { by: "calories", label: "Total calories" },
  { by: "times", label: "Times logged" },
];

// Which Foods the calories came from. Archived Foods are included and marked, because their Entries
// still count; tapping one opens it where it can be edited or restored.
export function TopFoodsCard({ range }: { range: PeriodRange }) {
  const { data, isPending, isError, refetch } = useFoodTotals(range);
  const [by, setBy] = useState<TopBy>("calories");
  const top = data ? topFoods(data, by) : [];

  return (
    <section
      aria-labelledby="top-foods-heading"
      className="flex flex-col gap-3 rounded-2xl border p-4"
    >
      <h2 id="top-foods-heading" className="font-medium text-lg">
        Top foods
      </h2>

      <fieldset className="m-0 flex min-w-0 gap-1 rounded-full border border-input p-0.5">
        <legend className="sr-only">Rank by</legend>
        {CHOICES.map((choice) => (
          <button
            key={choice.by}
            type="button"
            aria-pressed={by === choice.by}
            onClick={() => setBy(choice.by)}
            className={cn(
              "min-h-11 flex-1 rounded-full px-3 text-sm",
              by === choice.by
                ? "bg-primary text-primary-foreground"
                : "text-foreground",
            )}
          >
            {choice.label}
          </button>
        ))}
      </fieldset>

      {isPending ? (
        <div
          aria-hidden="true"
          className="h-24 animate-pulse rounded-lg bg-muted"
        />
      ) : null}

      {isError ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p>Couldn't load your top foods.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {data && top.length === 0 ? (
        <p className="py-4 text-center text-muted-foreground text-sm">
          Nothing logged in this period
        </p>
      ) : null}

      {top.length > 0 ? (
        <ol aria-label="Top foods" className="flex flex-col">
          {top.map((food) => (
            <li key={food.foodId} className="border-b last:border-b-0">
              <Link
                href={
                  food.archived
                    ? "/foods/archived"
                    : `/foods?food=${food.foodId}`
                }
                className="flex min-h-14 flex-col justify-center gap-1.5 py-2"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">
                    {food.name}
                    {food.archived ? (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-normal text-muted-foreground text-xs">
                        Archived
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {number(food.calories)} kcal
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${food.sharePct}%` }}
                  />
                </span>
                <span className="flex justify-between text-muted-foreground text-xs tabular-nums">
                  <span>{food.sharePct}% of your calories</span>
                  <span>
                    {food.entryCount} {food.entryCount === 1 ? "time" : "times"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
