"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatFoodDetail } from "./domain";
import { useArchivedFoods, useRestoreFood } from "./queries";
import type { Food } from "./types";

function ArchivedRow({
  food,
  onRestore,
}: {
  food: Food;
  onRestore: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{food.name}</span>
        <span className="text-muted-foreground text-sm">
          {formatFoodDetail(food)}
        </span>
      </div>
      <Button
        variant="outline"
        className="h-11 shrink-0 px-4"
        aria-label={`Restore ${food.name}`}
        onClick={onRestore}
      >
        Restore
      </Button>
    </li>
  );
}

export function ArchivedFoodsScreen() {
  const { data: foods, isPending, isError, refetch } = useArchivedFoods();
  const restoreFood = useRestoreFood();

  function restore(food: Food) {
    restoreFood.mutate(food, {
      onSuccess: () => toast(`Restored ${food.name}`),
      onError: (error) =>
        toast.error(error.message, {
          action: { label: "Retry", onClick: () => restore(food) },
        }),
    });
  }

  return (
    <main className="flex flex-1 flex-col gap-4">
      <Link
        href="/foods"
        className="flex min-h-11 w-fit items-center gap-1.5 text-muted-foreground text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Foods
      </Link>
      <h1 className="font-semibold text-2xl tracking-tight">Archived foods</h1>
      <p className="text-muted-foreground text-sm">
        These are hidden from your list and the picker, but past Entries still
        count their calories. Restore one to use it again.
      </p>

      {isPending ? (
        <div
          aria-hidden="true"
          className="h-14 animate-pulse rounded-lg bg-muted"
        />
      ) : null}

      {isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border p-4"
        >
          <p>Couldn't load your archived foods.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {foods?.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          No archived foods.
        </p>
      ) : null}

      {foods && foods.length > 0 ? (
        <ul aria-label="Archived foods">
          {foods.map((food) => (
            <ArchivedRow
              key={food.id}
              food={food}
              onRestore={() => restore(food)}
            />
          ))}
        </ul>
      ) : null}
    </main>
  );
}
