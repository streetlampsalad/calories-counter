"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCalories } from "@/features/foods/domain";
import type { Food } from "@/features/foods/types";
import { cn } from "@/lib/utils";
import { formatFromKilojoules } from "./parse";
import {
  checkRow,
  type DuplicateAction,
  type EditableField,
  planCounts,
  planFor,
  type ReviewRow,
  type ReviewState,
} from "./review";

type Props = {
  state: ReviewState;
  /** The User's live Foods, to spot rows that are already in the list. */
  foods: readonly Food[];
  onEdit: (id: string, field: EditableField, value: string) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string, action: DuplicateAction) => void;
};

function Field({
  label,
  value,
  error,
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  inputMode?: "numeric";
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-11"
      />
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DuplicateChoice({
  row,
  existing,
  onDuplicate,
}: {
  row: ReviewRow;
  existing: Food;
  onDuplicate: Props["onDuplicate"];
}) {
  const name = useId();
  return (
    <fieldset className="m-0 flex flex-col gap-2 rounded-lg bg-muted p-3">
      <legend className="sr-only">If it's already in your list</legend>
      <p className="text-sm">
        Already in your list ({formatCalories(existing.calories)})
      </p>
      <div className="flex gap-2">
        {(
          [
            ["skip", "Skip"],
            ["update", "Update existing"],
          ] as const
        ).map(([action, label]) => (
          <label
            key={action}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 text-center text-sm",
              row.onDuplicate === action
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background",
            )}
          >
            <input
              type="radio"
              name={name}
              checked={row.onDuplicate === action}
              onChange={() => onDuplicate(row.id, action)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
      {row.onDuplicate === "update" ? (
        <p className="text-muted-foreground text-xs">
          Past days will use the new calories.
        </p>
      ) : null}
    </fieldset>
  );
}

function ReviewCard({
  row,
  position,
  foods,
  onEdit,
  onToggle,
  onDuplicate,
}: {
  row: ReviewRow;
  position: number;
  foods: readonly Food[];
  onEdit: Props["onEdit"];
  onToggle: Props["onToggle"];
  onDuplicate: Props["onDuplicate"];
}) {
  const check = checkRow(row);
  const errors = check.ok ? {} : check.errors;
  const flagged = !check.ok;
  const plan = planFor({ ...row, keep: true }, foods);
  const existing =
    plan.kind === "skip" || plan.kind === "update" ? plan.existing : null;
  const status = flagged
    ? "Needs fixing"
    : !row.keep
      ? "Skipped"
      : planFor(row, foods).kind === "update"
        ? "Will update your existing food"
        : planFor(row, foods).kind === "skip"
          ? "Skipped, already in your list"
          : "Will be added";
  const converted = check.ok ? check.value : null;
  // A row that came in as kilojoules shows the Calories it converts to, until the User types their own.
  const calories =
    row.calories !== ""
      ? row.calories
      : converted?.fromKilojoules != null
        ? String(converted.calories)
        : "";

  return (
    <li
      aria-label={`Row ${position}`}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4",
        !row.keep && "bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm">{status}</span>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <span>Save this food</span>
          <input
            type="checkbox"
            role="switch"
            aria-checked={row.keep}
            checked={row.keep}
            disabled={flagged}
            onChange={() => onToggle(row.id)}
            className="size-6 accent-primary"
          />
        </label>
      </div>
      <Field
        label="Name"
        value={row.name}
        error={errors.name}
        onChange={(value) => onEdit(row.id, "name", value)}
      />
      <Field
        label="Portion"
        value={row.portion}
        error={errors.portion}
        onChange={(value) => onEdit(row.id, "portion", value)}
      />
      <Field
        label="Calories"
        value={calories}
        error={errors.calories}
        inputMode="numeric"
        onChange={(value) => onEdit(row.id, "calories", value)}
      />
      {existing ? (
        <DuplicateChoice
          row={row}
          existing={existing}
          onDuplicate={onDuplicate}
        />
      ) : null}
      {row.merged > 0 ? (
        <p className="text-muted-foreground text-xs">
          Merged with {row.merged} identical {row.merged === 1 ? "row" : "rows"}
          {row.alsoListed.length > 0
            ? `. Another row said ${row.alsoListed.join(", ")}.`
            : "."}
        </p>
      ) : null}
      {converted?.fromKilojoules != null && row.calories === "" ? (
        <p className="text-muted-foreground text-xs">
          {formatFromKilojoules(converted.fromKilojoules)}
        </p>
      ) : null}
    </li>
  );
}

// Every row of the Import, to fix, switch off or leave as it is before anything is saved.
export function ReviewList({
  state,
  foods,
  onEdit,
  onToggle,
  onDuplicate,
}: Props) {
  const counts = planCounts(state, foods);
  const saved = counts.add + counts.update;
  const flagged = counts.flagged;

  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-3">
      <h2 id="review-heading" className="font-medium text-lg">
        Review
      </h2>
      <p className="text-muted-foreground text-sm">
        {saved} of {state.rows.length}{" "}
        {state.rows.length === 1 ? "row" : "rows"} will be saved
        {counts.skip > 0 ? `, ${counts.skip} already in your list` : ""}
        {flagged > 0
          ? `, ${flagged} ${flagged === 1 ? "needs" : "need"} fixing`
          : ""}
        .
      </p>
      <ul aria-label="Rows to review" className="flex flex-col gap-3">
        {state.rows.map((row, index) => (
          <ReviewCard
            key={row.id}
            row={row}
            position={index + 1}
            foods={foods}
            onEdit={onEdit}
            onToggle={onToggle}
            onDuplicate={onDuplicate}
          />
        ))}
      </ul>
    </section>
  );
}
