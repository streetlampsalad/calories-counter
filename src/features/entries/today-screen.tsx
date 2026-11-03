"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { dayLabel, parseDay } from "./days";
import { DailyTotal, EntryList } from "./entry-list";
import { useDayEntries } from "./queries";
import { useToday } from "./use-today";

function Skeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      <div className="h-14 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

function DayView({ day, today }: { day: string; today: string }) {
  const { data: entries, isPending, isError, refetch } = useDayEntries(day);

  return (
    <main className="flex flex-1 flex-col gap-4">
      <h1 className="font-semibold text-2xl tracking-tight">
        {dayLabel(day, today)}
      </h1>

      {isPending ? <Skeleton /> : null}

      {isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border p-4"
        >
          <p>Couldn't load this day.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {entries ? (
        <>
          <DailyTotal entries={entries} />
          <EntryList entries={entries} />
        </>
      ) : null}
    </main>
  );
}

// The Day comes from the URL (?day=2026-11-03) so the back button works; no parameter means today.
export function TodayScreen() {
  const today = useToday();
  const params = useSearchParams();

  if (!today) {
    return (
      <main className="flex flex-1 flex-col">
        <Skeleton />
      </main>
    );
  }
  return (
    <DayView
      day={parseDay(params.get("day") ?? undefined, today)}
      today={today}
    />
  );
}
