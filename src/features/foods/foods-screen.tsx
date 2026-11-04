"use client";

import { Archive, Plus, Salad } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SelectionBar } from "@/components/selection/selection-bar";
import { SelectionCheck } from "@/components/selection/selection-check";
import { useLongPress } from "@/components/selection/use-long-press";
import {
  type SelectionState,
  useSelection,
} from "@/components/selection/use-selection";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddFoodSheet } from "./add-food-sheet";
import { filterFoods, formatFoodDetail } from "./domain";
import { EditFoodSheet } from "./edit-food-sheet";
import { FoodSearchBox } from "./food-search-box";
import {
  type RemovedFoods,
  useAddFood,
  useFoodEntryCounts,
  useFoods,
  useRemoveFood,
  useRemoveFoods,
  useRestoreFood,
  useRestoreFoods,
  useUpdateFood,
} from "./queries";
import { RemoveFoodsSheet } from "./remove-foods-sheet";
import type { Food, FoodInput } from "./types";

// Tap to edit; hold to start picking Foods, and then tap to pick (spec 014).
function FoodRow({
  food,
  selection,
  onEdit,
}: {
  food: Food;
  selection: SelectionState;
  onEdit: () => void;
}) {
  const press = useLongPress({
    onLongPress: () =>
      selection.selecting
        ? selection.toggle(food.id)
        : selection.start(food.id),
    onPress: () => (selection.selecting ? selection.toggle(food.id) : onEdit()),
  });
  const picked = selection.isSelected(food.id);

  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        aria-label={`${selection.selecting ? "" : "Edit "}${food.name}, ${formatFoodDetail(food)}`}
        aria-pressed={selection.selecting ? picked : undefined}
        {...press}
        className={cn(
          "flex min-h-14 w-full select-none items-center gap-3 py-3 text-left [-webkit-touch-callout:none]",
          picked && "bg-muted",
        )}
      >
        {selection.selecting ? <SelectionCheck picked={picked} /> : null}
        <span className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="font-medium">{food.name}</span>
          <span className="text-muted-foreground text-sm">
            {formatFoodDetail(food)}
          </span>
        </span>
      </button>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className="h-12 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <Salad aria-hidden="true" className="size-10 text-muted-foreground" />
      <h2 className="font-medium text-lg">No foods yet</h2>
      <p className="max-w-64 text-muted-foreground text-sm">
        Foods are the things you eat, each with the calories in one portion. Add
        a few, then log them in two taps.
      </p>
      <Button onClick={onAdd} className="mt-2 h-12 px-6 text-base">
        <Plus aria-hidden="true" /> Add food
      </Button>
    </div>
  );
}

export function FoodsScreen() {
  const { data: foods, isPending, isError, refetch } = useFoods();
  const addFood = useAddFood();
  const updateFood = useUpdateFood();
  const removeFood = useRemoveFood();
  const restoreFood = useRestoreFood();
  const removeFoods = useRemoveFoods();
  const restoreFoods = useRestoreFoods();
  const selection = useSelection();
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Food | null>(null);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const linkedFood = useSearchParams().get("food");
  // Filtered in memory on every keystroke: no request, however long the list gets.
  const visible = foods ? filterFoods(foods, query) : undefined;
  // What is picked, even if a search is hiding some of it.
  const picked = foods?.filter((food) => selection.isSelected(food.id)) ?? [];
  const { data: entryCounts } = useFoodEntryCounts(selection.selecting);

  // Leaving selection mode (back, ✕) closes the confirmation with it.
  useEffect(() => {
    if (!selection.selecting) setConfirming(false);
  }, [selection.selecting]);

  // A link such as /foods?food=<id> (from Insights) opens that Food once, then tidies the address.
  useEffect(() => {
    if (!linkedFood || !foods) return;
    const food = foods.find((candidate) => candidate.id === linkedFood);
    if (food) setEditing(food);
    router.replace("/foods");
  }, [linkedFood, foods, router]);

  function save(input: FoodInput) {
    const food: Food = { id: crypto.randomUUID(), archivedAt: null, ...input };
    addFood.mutate(food, {
      onError: (error) =>
        toast.error(error.message, {
          action: { label: "Retry", onClick: () => addFood.mutate(food) },
        }),
    });
  }

  function remove(food: Food, hasEntries: boolean) {
    setEditing(null);
    removeFood.mutate(
      { food, hasEntries },
      {
        onSuccess: (outcome) =>
          outcome === "archived"
            ? toast(`Archived ${food.name}`, {
                action: {
                  label: "Undo",
                  onClick: () =>
                    restoreFood.mutate(food, {
                      onError: (error) => toast.error(error.message),
                    }),
                },
              })
            : toast(`Deleted ${food.name}`),
        onError: (error) =>
          toast.error(error.message, {
            action: {
              label: "Retry",
              onClick: () => removeFood.mutate({ food, hasEntries }),
            },
          }),
      },
    );
  }

  // Each Food with Entries is archived and the rest deleted, as the server decides; Undo reverses both.
  function removePicked(targets: Food[]) {
    removeFoods.mutate(targets, {
      onSuccess: (removed) => {
        const count = removed.archived.length + removed.deleted.length;
        toast(`Removed ${count} ${count === 1 ? "food" : "foods"}`, {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: () => undoRemoval(removed),
          },
        });
      },
      onError: (error) =>
        toast.error(error.message, {
          action: { label: "Retry", onClick: () => removePicked(targets) },
        }),
    });
  }

  function undoRemoval(removed: RemovedFoods) {
    restoreFoods.mutate(removed, {
      onError: (error) =>
        toast.error(error.message, {
          action: { label: "Retry", onClick: () => undoRemoval(removed) },
        }),
    });
  }

  function confirmRemoval() {
    const targets = picked;
    setConfirming(false);
    selection.clear();
    if (targets.length > 0) removePicked(targets);
  }

  function saveChanges(food: Food) {
    setEditing(null);
    updateFood.mutate(food, {
      onError: (error) =>
        toast.error(error.message, {
          action: { label: "Retry", onClick: () => updateFood.mutate(food) },
        }),
    });
  }

  return (
    <main className="flex flex-1 flex-col gap-4">
      {selection.selecting ? (
        <SelectionBar
          count={selection.count}
          onSelectAll={() =>
            // Adds what is shown to what is already picked, so a search never drops a pick.
            selection.selectAll([
              ...selection.selected,
              ...(visible ?? []).map((food) => food.id),
            ])
          }
          onDelete={() => setConfirming(true)}
          onClear={selection.clear}
        />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">Foods</h1>
          <Link
            href="/foods/archived"
            className="flex min-h-11 items-center gap-1.5 text-muted-foreground text-sm"
          >
            <Archive aria-hidden="true" className="size-4" /> Archived foods
          </Link>
        </div>
      )}

      {isPending ? <ListSkeleton /> : null}

      {isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border p-4"
        >
          <p>Couldn't load your foods.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {foods?.length === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : null}

      {foods && foods.length > 0 ? (
        <FoodSearchBox value={query} onChange={setQuery} />
      ) : null}

      {visible && visible.length > 0 ? (
        <ul aria-label="Your foods">
          {visible.map((food) => (
            <FoodRow
              key={food.id}
              food={food}
              selection={selection}
              onEdit={() => setEditing(food)}
            />
          ))}
        </ul>
      ) : null}

      {foods && foods.length > 0 && visible?.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p>
            No foods match <span className="font-medium">“{query.trim()}”</span>
          </p>
          <Button variant="outline" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      ) : null}

      {foods && foods.length > 0 && !selection.selecting ? (
        // Within thumb reach, just above the bottom navigation. Out of the way while picking.
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] z-30 mx-auto flex max-w-md justify-end px-4">
          <Button
            onClick={() => setAdding(true)}
            className="pointer-events-auto h-12 gap-2 rounded-full px-5 text-base shadow-lg"
          >
            <Plus aria-hidden="true" /> Add food
          </Button>
        </div>
      ) : null}

      <RemoveFoodsSheet
        open={confirming && selection.selecting}
        foods={picked}
        entryCounts={entryCounts}
        onConfirm={confirmRemoval}
        onClose={() => setConfirming(false)}
      />

      <EditFoodSheet
        food={editing}
        foods={foods ?? []}
        onSave={saveChanges}
        onRemove={remove}
        onClose={() => setEditing(null)}
      />

      <AddFoodSheet
        open={adding}
        foods={foods ?? []}
        onSave={save}
        onEditExisting={(food) => {
          setAdding(false);
          setEditing(food);
        }}
        onClose={() => setAdding(false)}
      />
    </main>
  );
}
