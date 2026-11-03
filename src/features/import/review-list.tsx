"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatFromKilojoules } from "./parse";
import {
  checkRow,
  type EditableField,
  keptCount,
  type ReviewRow,
  type ReviewState,
} from "./review";

type Props = {
  state: ReviewState;
  onEdit: (id: string, field: EditableField, value: string) => void;
  onToggle: (id: string) => void;
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

function ReviewCard({
  row,
  position,
  onEdit,
  onToggle,
}: {
  row: ReviewRow;
  position: number;
  onEdit: Props["onEdit"];
  onToggle: Props["onToggle"];
}) {
  const check = checkRow(row);
  const errors = check.ok ? {} : check.errors;
  const flagged = !check.ok;
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
        <span className="text-muted-foreground text-sm">
          {flagged ? "Needs fixing" : row.keep ? "Will be saved" : "Skipped"}
        </span>
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
      {converted?.fromKilojoules != null && row.calories === "" ? (
        <p className="text-muted-foreground text-xs">
          {formatFromKilojoules(converted.fromKilojoules)}
        </p>
      ) : null}
    </li>
  );
}

// Every row of the Import, to fix, switch off or leave as it is before anything is saved.
export function ReviewList({ state, onEdit, onToggle }: Props) {
  const kept = keptCount(state);
  const flagged = state.rows.filter((row) => !checkRow(row).ok).length;

  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-3">
      <h2 id="review-heading" className="font-medium text-lg">
        Review
      </h2>
      <p className="text-muted-foreground text-sm">
        {kept} of {state.rows.length} {state.rows.length === 1 ? "row" : "rows"}{" "}
        will be saved
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
            onEdit={onEdit}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </section>
  );
}
