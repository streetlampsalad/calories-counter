"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { filterFoods, formatFoodDetail } from "@/features/foods/domain";
import { FoodSearchBox } from "@/features/foods/food-search-box";
import { useFoods } from "@/features/foods/queries";
import type { Food } from "@/features/foods/types";
import { cn } from "@/lib/utils";
import { shiftDay } from "./days";
import { QuantityPicker } from "./quantity-picker";
import { useFoodUsage } from "./queries";
import { rankFoodsByUsage, recentFoods, USAGE_WINDOW_DAYS } from "./usage";

type Props = {
  open: boolean;
  /** The device's date: Foods are ranked by what was eaten up to it, not what is planned after. */
  today: string;
  /** The chosen Food and how many Portions of it. */
  onPick: (food: Food, quantity: number) => void;
  onClose: () => void;
};

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      {children}
    </div>
  );
}

export function FoodPickerSheet({ open, today, onPick, onClose }: Props) {
  const { data: foods, isPending, isError, refetch } = useFoods();
  const { data: usage } = useFoodUsage(
    shiftDay(today, -USAGE_WINDOW_DAYS),
    today,
    open,
  );
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [recentId, setRecentId] = useState<string | null>(null);

  // Every time the picker is opened it starts fresh, not on the last search and open Food.
  useEffect(() => {
    if (open) {
      setQuery("");
      setOpenId(null);
      setRecentId(null);
    }
  }, [open]);

  // Most-logged Foods first; while no one is searching, the latest few are one tap away above.
  const ranked = foods ? rankFoodsByUsage(foods, usage ?? []) : undefined;
  const visible = ranked ? filterFoods(ranked, query) : undefined;
  const recent = foods && !query.trim() ? recentFoods(foods, usage ?? []) : [];
  const recentChoice = recent.find((food) => food.id === recentId);

  function pick(food: Food, quantity: number) {
    onPick(food, quantity);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      {/* Same variant as the sheet's own `h-auto`, so cn replaces it: a plain h-[85dvh] loses to it. */}
      <SheetContent side="bottom" className="data-[side=bottom]:h-[85dvh]">
        <SheetHeader>
          <SheetTitle>Add to your day</SheetTitle>
          <SheetDescription>
            Pick a food, then how much you had.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-6">
          {foods && foods.length > 0 ? (
            <FoodSearchBox
              value={query}
              onChange={(next) => {
                setQuery(next);
                setOpenId(null);
                setRecentId(null);
              }}
            />
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {recent.length > 0 ? (
              <fieldset className="m-0 mb-3 min-w-0 border-0 p-0">
                <legend className="mb-2 font-medium text-muted-foreground text-sm">
                  Recent
                </legend>
                <div className="flex flex-wrap gap-2">
                  {recent.map((food) => {
                    const selected = recentId === food.id;
                    return (
                      <button
                        key={food.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setRecentId(selected ? null : food.id);
                          setOpenId(null);
                        }}
                        className={cn(
                          "min-h-11 rounded-full border px-4 text-sm",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-background text-foreground",
                        )}
                      >
                        {food.name}
                      </button>
                    );
                  })}
                </div>
                {recentChoice ? (
                  <div className="pt-3">
                    <QuantityPicker
                      key={recentChoice.id}
                      onChoose={(quantity) => pick(recentChoice, quantity)}
                    />
                  </div>
                ) : null}
              </fieldset>
            ) : null}

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
                <p>Couldn't load your foods.</p>
                <Button variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            ) : null}

            {foods?.length === 0 ? (
              <Message>
                <p className="font-medium">You have no foods yet</p>
                <p className="text-muted-foreground text-sm">
                  Add the things you eat once, then log them in two taps.
                </p>
                <Button
                  render={<Link href="/foods" />}
                  className="h-12 px-6 text-base"
                >
                  Add your first food
                </Button>
              </Message>
            ) : null}

            {foods && foods.length > 0 && visible?.length === 0 ? (
              <Message>
                <p>
                  No foods match{" "}
                  <span className="font-medium">“{query.trim()}”</span>
                </p>
              </Message>
            ) : null}

            {visible && visible.length > 0 ? (
              <ul aria-label="Your foods">
                {visible.map((food) => {
                  const expanded = openId === food.id;
                  return (
                    <li key={food.id} className="border-b last:border-b-0">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => {
                          setOpenId(expanded ? null : food.id);
                          setRecentId(null);
                        }}
                        className={cn(
                          "flex min-h-14 w-full flex-col items-start justify-center gap-0.5 py-3 text-left",
                        )}
                      >
                        <span className="font-medium">{food.name}</span>
                        <span className="text-muted-foreground text-sm">
                          {formatFoodDetail(food)}
                        </span>
                      </button>
                      {expanded ? (
                        <div className="pb-4">
                          <QuantityPicker
                            onChoose={(quantity) => pick(food, quantity)}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
