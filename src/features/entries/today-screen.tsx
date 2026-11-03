"use client";

import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Food } from "@/features/foods/types";
import { dayLabel, parseDay } from "./days";
import { formatQuantity } from "./domain";
import { EditEntrySheet } from "./edit-entry-sheet";
import { DailyTotal, EntryList } from "./entry-list";
import { FoodPickerSheet } from "./picker-sheet";
import {
  useAddEntry,
  useDayEntries,
  useRemoveEntry,
  useUpdateEntryQuantity,
} from "./queries";
import type { Entry } from "./types";
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
  const addEntry = useAddEntry();
  const removeEntry = useRemoveEntry();
  const updateQuantity = useUpdateEntryQuantity();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);

  function changeQuantity(entry: Entry, quantity: number) {
    updateQuantity.mutate(
      { entry, quantity },
      {
        onError: (error) =>
          toast.error(error.message, {
            action: {
              label: "Retry",
              onClick: () => updateQuantity.mutate({ entry, quantity }),
            },
          }),
      },
    );
  }

  // Undo puts the very same Entry back, in its original place in the list.
  function remove(entry: Entry) {
    removeEntry.mutate(entry, {
      onError: (error) => toast.error(error.message),
    });
    toast(`Removed ${formatQuantity(entry.quantity)} × ${entry.food.name}`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () =>
          addEntry.mutate(entry, {
            onError: (error) => toast.error(error.message),
          }),
      },
    });
  }

  // The Entry shows up at once; the toast offers Undo, and a failed save takes it back off.
  function log(food: Food, quantity: number) {
    const entry: Entry = {
      id: crypto.randomUUID(),
      day,
      quantity,
      createdAt: new Date().toISOString(),
      food: {
        id: food.id,
        name: food.name,
        portion: food.portion,
        calories: food.calories,
      },
    };
    const added = toast(`Added ${formatQuantity(quantity)} × ${food.name}`, {
      action: {
        label: "Undo",
        onClick: () =>
          removeEntry.mutate(entry, {
            onError: (error) => toast.error(error.message),
          }),
      },
    });
    addEntry.mutate(entry, {
      onError: (error) => {
        toast.dismiss(added);
        toast.error(error.message, {
          action: { label: "Retry", onClick: () => addEntry.mutate(entry) },
        });
      },
    });
  }

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
          <EntryList entries={entries} onSelect={setEditing} />
        </>
      ) : null}

      {/* Within thumb reach, just above the bottom navigation. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] z-30 mx-auto flex max-w-md justify-end px-4">
        <Button
          onClick={() => setPicking(true)}
          className="pointer-events-auto h-14 gap-2 rounded-full px-6 text-base shadow-lg"
        >
          <Plus aria-hidden="true" /> Add
        </Button>
      </div>

      <EditEntrySheet
        entry={editing}
        onChange={changeQuantity}
        onRemove={remove}
        onClose={() => setEditing(null)}
      />

      <FoodPickerSheet
        open={picking}
        today={today}
        onPick={log}
        onClose={() => setPicking(false)}
      />
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
