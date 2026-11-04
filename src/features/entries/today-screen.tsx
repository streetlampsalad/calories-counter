"use client";

import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SelectionBar } from "@/components/selection/selection-bar";
import { useSelection } from "@/components/selection/use-selection";
import { Button } from "@/components/ui/button";
import { BurnedRow } from "@/features/burned/burned-row";
import type { Food } from "@/features/foods/types";
import { useSettings } from "@/features/settings/queries";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { DayHeader } from "./day-header";
import { isPlanned, lastPlannableDay, parseDay, shiftDay } from "./days";
import { addedMessage, formatQuantity, removedEntriesMessage } from "./domain";
import { EditEntrySheet } from "./edit-entry-sheet";
import { DailyTotal, EntryList } from "./entry-list";
import { FoodPickerSheet } from "./picker-sheet";
import {
  useAddEntries,
  useAddEntry,
  useDayEntries,
  useRemoveEntries,
  useRemoveEntry,
  useUpdateEntryQuantity,
} from "./queries";
import type { Entry } from "./types";
import { useDaySwipe } from "./use-day-swipe";
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

function DayView({ urlDay, today }: { urlDay: string; today: string }) {
  const router = useRouter();
  // The Day shown moves the instant it is chosen; the URL catches up a moment later. Without
  // this, two quick taps on an arrow would both step from the URL's old Day and go back only one.
  const [day, setDay] = useState(urlDay);
  useEffect(() => setDay(urlDay), [urlDay]);
  const { data: entries, isPending, isError, refetch } = useDayEntries(day);
  const { data: settings } = useSettings();

  // Each Day is a history entry, so the back button returns to the Day before. Today is just "/".
  const goToDay = (next: string) => {
    setDay(next);
    router.push(next === today ? "/" : `/?day=${next}`);
  };
  const addEntry = useAddEntry();
  const removeEntry = useRemoveEntry();
  const addEntries = useAddEntries();
  const removeEntries = useRemoveEntries();
  const updateQuantity = useUpdateEntryQuantity();
  const selection = useSelection();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  // Which way the Day just swiped in from, so its content can slide in. Arrows do not slide.
  const [slide, setSlide] = useState<"next" | "previous" | null>(null);
  const swipe = useDaySwipe({
    // Not while a sheet is open or items are being picked: those gestures are theirs.
    enabled: !picking && editing === null && !selection.selecting,
    canGoNext: day < lastPlannableDay(today),
    onSwipe: (direction, animate) => {
      setSlide(animate ? direction : null);
      goToDay(shiftDay(day, direction === "next" ? 1 : -1));
    },
  });

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

  // Everything picked goes at once, with no confirmation: Undo brings the same Entries back.
  function removePicked() {
    const picked = (entries ?? []).filter((entry) =>
      selection.isSelected(entry.id),
    );
    if (picked.length === 0) return;
    haptic("confirm");
    selection.clear();
    const removed = toast(removedEntriesMessage(picked.length), {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () =>
          addEntries.mutate(picked, {
            onError: (error) => toast.error(error.message),
          }),
      },
    });
    removeEntries.mutate(picked, {
      onError: (error) => {
        toast.dismiss(removed);
        toast.error(error.message, {
          action: {
            label: "Retry",
            onClick: () => removeEntries.mutate(picked),
          },
        });
      },
    });
  }

  // The Entry shows up at once; the toast offers Undo, and a failed save takes it back off.
  function log(food: Food, quantity: number) {
    haptic("tap");
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
    const added = toast(addedMessage(food.name, quantity, day, today), {
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
    <main
      {...swipe.gestureProps}
      className="flex flex-1 touch-pan-y touch-pinch-zoom select-none flex-col gap-4"
    >
      {/* The selection bar sits over the Day header rather than replacing it, so the header's
          height (taller with the Today button) is kept and the list never jumps (bug #83). */}
      <div className="relative">
        <div
          inert={selection.selecting}
          className={cn(selection.selecting && "invisible")}
        >
          <DayHeader
            day={day}
            today={today}
            onChange={(next) => {
              setSlide(null);
              goToDay(next);
            }}
          />
        </div>
        {selection.selecting ? (
          <div className="absolute inset-x-0 top-0">
            <SelectionBar
              count={selection.count}
              onSelectAll={() =>
                selection.selectAll((entries ?? []).map((e) => e.id))
              }
              onDelete={removePicked}
              onClear={selection.clear}
            />
          </div>
        ) : null}
      </div>

      {/* Follows the finger while swiping, and a new Day's content slides in from its side. */}
      <div
        key={day}
        data-slide={slide ?? undefined}
        style={{
          transform: swipe.offset ? `translateX(${swipe.offset}px)` : undefined,
          transition: swipe.dragging ? "none" : "transform 150ms ease-out",
        }}
        className={cn(
          "flex flex-1 flex-col gap-4",
          slide === "next" &&
            "motion-safe:fade-in motion-safe:slide-in-from-right-8 motion-safe:animate-in motion-safe:duration-200",
          slide === "previous" &&
            "motion-safe:fade-in motion-safe:slide-in-from-left-8 motion-safe:animate-in motion-safe:duration-200",
        )}
      >
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
            <DailyTotal
              entries={entries}
              goal={settings?.dailyGoal ?? null}
              planned={isPlanned(day, today)}
            />
            <BurnedRow day={day} today={today} entries={entries} />
            <EntryList
              entries={entries}
              onSelect={setEditing}
              selection={{
                selecting: selection.selecting,
                isSelected: selection.isSelected,
                onStart: (entry) => selection.start(entry.id),
                onToggle: (entry) => selection.toggle(entry.id),
              }}
            />
          </>
        ) : null}
      </div>

      {/* Within thumb reach, just above the bottom navigation. Out of the way while picking. */}
      {selection.selecting ? null : (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] z-30 mx-auto flex max-w-md justify-end px-4">
          <Button
            onClick={() => setPicking(true)}
            className="pointer-events-auto h-14 gap-2 rounded-full px-6 text-base shadow-lg"
          >
            <Plus aria-hidden="true" /> Add
          </Button>
        </div>
      )}

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
      urlDay={parseDay(params.get("day") ?? undefined, today)}
      today={today}
    />
  );
}
