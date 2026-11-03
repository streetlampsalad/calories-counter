"use client";

import { ArrowLeft, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFoodDetail, matchesFoodQuery } from "@/features/foods/domain";
import { useAddFood, useFoods } from "@/features/foods/queries";
import type { Food, FoodInput } from "@/features/foods/types";
import { normalizeText } from "@/features/foods/validation";
import { FoodDataAttribution } from "./attribution";
import { askBestGuess } from "./guess";
import { MIN_QUERY } from "./limits";
import { useProductSearch, useReferenceSearch } from "./queries";
import { SuggestionSheet } from "./suggestion-sheet";
import { describeEnergy, type Suggestion } from "./suggestions";

const YOUR_FOODS_SHOWN = 5;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="font-medium text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SuggestionRow({
  suggestion,
  onPick,
}: {
  suggestion: Suggestion;
  onPick: () => void;
}) {
  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        onClick={onPick}
        className="flex min-h-14 w-full flex-col items-start justify-center gap-0.5 py-3 text-left"
      >
        <span className="font-medium">{suggestion.name}</span>
        {suggestion.brand ? (
          <span className="text-muted-foreground text-sm">
            {suggestion.brand}
          </span>
        ) : null}
        <span className="text-muted-foreground text-sm">
          {describeEnergy(suggestion)}
        </span>
      </button>
    </li>
  );
}

// Look a food up by name: your own list first, then Australian reference foods. Picking one
// opens the Food form with its values, ready to adjust and save.
export function SearchScreen() {
  const router = useRouter();
  const inputId = useId();
  const { data: foods } = useFoods();
  const addFood = useAddFood();
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [tooShort, setTooShort] = useState(false);
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [guessing, setGuessing] = useState<
    "idle" | "asking" | "unavailable" | "failed"
  >("idle");
  const reference = useReferenceSearch(submitted);
  const products = useProductSearch(submitted);

  const yours: Food[] = submitted
    ? (foods ?? [])
        .filter((food) => matchesFoodQuery(food, submitted))
        .slice(0, YOUR_FOODS_SHOWN)
    : [];

  function search(event: React.FormEvent) {
    event.preventDefault();
    const query = normalizeText(draft);
    setTooShort(query.length < MIN_QUERY);
    if (query.length >= MIN_QUERY) setSubmitted(query);
  }

  async function bestGuess() {
    setGuessing("asking");
    const result = await askBestGuess(submitted);
    if (result.kind === "guess") {
      setGuessing("idle");
      setPicked(result.suggestion);
    } else {
      setGuessing(result.kind);
    }
  }

  function save(input: FoodInput) {
    const food: Food = { id: crypto.randomUUID(), archivedAt: null, ...input };
    addFood.mutate(food, {
      onSuccess: () => toast(`Added ${food.name}`),
      onError: (error) =>
        toast.error(error.message, {
          action: { label: "Retry", onClick: () => addFood.mutate(food) },
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
      <h1 className="font-semibold text-2xl tracking-tight">Search foods</h1>

      <form onSubmit={search} className="flex flex-col gap-2">
        <Label htmlFor={inputId}>Search for a food</Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Banana, rice, Vegemite…"
            enterKeyHint="search"
            autoComplete="off"
            className="h-12 text-base"
          />
          <Button type="submit" className="h-12 gap-2 px-4 text-base">
            <Search aria-hidden="true" /> Search
          </Button>
        </div>
        {tooShort ? (
          <p className="text-destructive text-sm">
            Type at least {MIN_QUERY} characters.
          </p>
        ) : null}
      </form>

      {yours.length > 0 ? (
        <Section title="Your foods">
          <ul aria-label="Your foods">
            {yours.map((food) => (
              <li key={food.id} className="border-b last:border-b-0">
                <Link
                  href={`/foods?food=${food.id}`}
                  className="flex min-h-14 flex-col justify-center gap-0.5 py-3"
                >
                  <span className="font-medium">{food.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {formatFoodDetail(food)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {submitted ? (
        <Section title="Australian foods">
          {reference.isPending ? (
            <div
              aria-hidden="true"
              className="h-24 animate-pulse rounded-lg bg-muted"
            />
          ) : null}
          {reference.isError ? (
            <div role="alert" className="flex flex-col items-start gap-2">
              <p>Couldn't search Australian foods.</p>
              <Button variant="outline" onClick={() => reference.refetch()}>
                Try again
              </Button>
            </div>
          ) : null}
          {reference.data && reference.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No Australian foods match “{submitted}”.
            </p>
          ) : null}
          {reference.data && reference.data.length > 0 ? (
            <ul aria-label="Australian foods">
              {reference.data.map((suggestion) => (
                <SuggestionRow
                  key={suggestion.key}
                  suggestion={suggestion}
                  onPick={() => setPicked(suggestion)}
                />
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      {submitted ? (
        <Section title="Packaged products">
          {products.isPending ? (
            <div
              aria-hidden="true"
              className="h-24 animate-pulse rounded-lg bg-muted"
            />
          ) : null}
          {products.isError ? (
            <p className="text-muted-foreground text-sm">
              Packaged products unavailable right now
            </p>
          ) : null}
          {products.data && products.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No Australian packaged products match “{submitted}”.
            </p>
          ) : null}
          {products.data && products.data.length > 0 ? (
            <ul aria-label="Packaged products">
              {products.data.map((suggestion) => (
                <SuggestionRow
                  key={suggestion.key}
                  suggestion={suggestion}
                  onPick={() => setPicked(suggestion)}
                />
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      {submitted ? (
        <Section title="Best guess">
          <p className="text-muted-foreground text-sm">
            Can't find it? Ask for an estimate. It is a guess, so check it
            before saving.
          </p>
          <Button
            variant="outline"
            onClick={bestGuess}
            disabled={guessing === "asking"}
            className="h-12 gap-2 text-base"
          >
            <Sparkles aria-hidden="true" />
            {guessing === "asking"
              ? "Estimating…"
              : `Best guess for “${submitted}”`}
          </Button>
          {guessing === "unavailable" ? (
            <p role="alert" className="text-sm">
              Best guess isn't available right now. The search above still
              works.
            </p>
          ) : null}
          {guessing === "failed" ? (
            <p role="alert" className="text-sm">
              Couldn't make a guess. Try again.
            </p>
          ) : null}
        </Section>
      ) : null}

      {submitted ? (
        <FoodDataAttribution className="text-muted-foreground text-xs" />
      ) : null}

      <SuggestionSheet
        suggestion={picked}
        foods={foods ?? []}
        onSave={save}
        onEditExisting={(food) => router.push(`/foods?food=${food.id}`)}
        onClose={() => setPicked(null)}
      />
    </main>
  );
}
