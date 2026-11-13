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
import type { MealTime } from "./meal-time";
import { FoodPickerSheet } from "./picker-sheet";
import {
  useAddEntries,
  useAddEntry,
  useDayEntries,
  useRemoveEntries,
  useRemoveEntry,
  useUpdateEntryMealTime,
  useUpdateEntryQuantity,
} from "./queries";
import { TodayPill } from "./today-pill";
import type { Entry } from "./types";
import { useDaySwipe } from "./use-day-swipe";
import { useToday } from "./use-today";

// While a Day loads, its Daily Total is drawn as its own card with the content hidden, and with
// the Goal's row when the User has one, so the real total lands exactly where this sat (bug #211).
// It sits where the real total will, as the first child of the same column, not in a wrapper.
function DaySkeleton({ goal }: { goal: number | null }) {
  return (
    <>
      <DailyTotal entries={[]} goal={goal} placeholder />
      <div
        aria-hidden="true"
        className="h-14 animate-pulse rounded-lg bg-muted"
      />
    </>
  );
}

function DayView({ urlDay, today }: { urlDay: string; today: string }) {
  const router = useRouter();
  // The Day shown moves the instant it is chosen; the URL catches up a moment later. Without
  // this, two quick taps on an arrow would both step from the URL's old Day and go back only one.
  const [day, setDay] = useState(urlDay);
  useEffect(() => setDay(urlDay), [urlDay]);
  const { data: entries, isPending, isError, refetch } = useDayEntries(day);
  const { data: settings, isPending: settingsPending } = useSettings();
  // The Daily Total waits for Settings too: drawn before the Goal is known, it would grow when the
  // Goal arrived and push everything below it down (bug #211).
  const loading = isPending || settingsPending;

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
  const updateMealTime = useUpdateEntryMealTime();
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

  function changeMealTime(entry: Entry, mealTime: MealTime | null) {
    updateMealTime.mutate(
      { entry, mealTime },
      {
        onError: (error) =>
          toast.error(error.message, {
            action: {
              label: "Retry",
              onClick: () => updateMealTime.mutate({ entry, mealTime }),
            },
          }),
      },
    );
  }

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
  function log(food: Food, quantity: number, mealTime: MealTime | null) {
    haptic("tap");
    const entry: Entry = {
      id: crypto.randomUUID(),
      day,
      quantity,
      createdAt: new Date().toISOString(),
      mealTime,
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
        {loading ? <DaySkeleton goal={settings?.dailyGoal ?? null} /> : null}

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

        {entries && !settingsPending ? (
          <>
            <DailyTotal
              entries={entries}
              goal={settings?.dailyGoal ?? null}
              planned={isPlanned(day, today)}
              dayKey={day}
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

      {/* Within thumb reach, just above the bottom navigation. Out of the way while picking. The
          way home to today sits opposite Add, so showing it moves nothing on the Day (spec 019). */}
      {selection.selecting ? null : (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] z-30 mx-auto flex max-w-md items-center justify-between px-4">
          <TodayPill visible={day !== today} onClick={() => goToDay(today)} />
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
        onChangeMealTime={changeMealTime}
        onRemove={remove}
        onClose={() => setEditing(null)}
      />

      <FoodPickerSheet
        open={picking}
        today={today}
        day={day}
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
  const { data: settings } = useSettings();

  if (!today) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        {/* As tall as the Day header, which is not drawn until today is known. */}
        <div aria-hidden="true" className="h-11" />
        <DaySkeleton goal={settings?.dailyGoal ?? null} />
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
