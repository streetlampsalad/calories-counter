"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  caloriesToKilojoules,
  kilojoulesToCalories,
  MAX_KILOJOULES,
  parseKilojoules,
} from "@/lib/energy";
import { cn } from "@/lib/utils";
import { type EnergyUnit, readEnergyUnit, saveEnergyUnit } from "./energy-unit";
import type { Food, FoodInput } from "./types";
import {
  type FoodErrors,
  type FoodFormValues,
  normalizeText,
  parseFoodInput,
} from "./validation";

// Australian, metric. Tapping one fills the Portion field, which stays freely editable.
export const PORTION_CHIPS = [
  "100 g",
  "100 ml",
  "1 serve",
  "1 slice",
  "1 cup",
  "1 piece",
] as const;

type Props = {
  initialValues?: Partial<FoodFormValues>;
  submitLabel?: string;
  /** Where prefilled values came from, e.g. "From Open Food Facts". */
  sourceLabel?: string;
  /** The live Food that already uses this name and Portion, if any. */
  findExisting?: (input: FoodInput) => Food | undefined;
  /** When given, a duplicate offers a button to open that existing Food for editing. */
  onEditExisting?: (food: Food) => void;
  onSubmit: (value: FoodInput) => void;
  /** When given, a "Save and add another" button saves, then clears the form for the next Food. */
  onSubmitAnother?: (value: FoodInput) => void;
};

type FieldProps = {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
} & Omit<React.ComponentProps<"input">, "id" | "value" | "onChange" | "ref">;

function Field({
  id,
  label,
  value,
  error,
  onChange,
  inputRef,
  ...inputProps
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-12 text-base"
        autoComplete="off"
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PortionChips({
  portion,
  onPick,
}: {
  portion: string;
  onPick: (chip: string) => void;
}) {
  const current = normalizeText(portion).toLowerCase();
  return (
    <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Common portions</legend>
      {PORTION_CHIPS.map((chip) => {
        const pressed = chip.toLowerCase() === current;
        return (
          <button
            key={chip}
            type="button"
            aria-pressed={pressed}
            onClick={() => onPick(chip)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm",
              pressed
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-foreground",
            )}
          >
            {chip}
          </button>
        );
      })}
    </fieldset>
  );
}

const NO_TOUCHED = { name: false, portion: false, calories: false };

function EnergyUnitToggle({
  unit,
  onChange,
}: {
  unit: EnergyUnit;
  onChange: (unit: EnergyUnit) => void;
}) {
  const option = (value: EnergyUnit, label: string) => (
    <button
      type="button"
      aria-pressed={unit === value}
      onClick={() => onChange(value)}
      className={cn(
        "min-h-11 min-w-14 rounded-full px-4 text-sm",
        unit === value
          ? "bg-primary text-primary-foreground"
          : "text-foreground",
      )}
    >
      {label}
    </button>
  );
  return (
    <fieldset className="m-0 flex min-w-0 gap-1 rounded-full border border-input p-0.5">
      <legend className="sr-only">Energy unit</legend>
      {option("kcal", "kcal")}
      {option("kj", "kJ")}
    </fieldset>
  );
}

export function FoodForm({
  initialValues,
  submitLabel = "Save",
  sourceLabel,
  findExisting,
  onEditExisting,
  onSubmit,
  onSubmitAnother,
}: Props) {
  const id = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<FoodFormValues>({
    name: initialValues?.name ?? "",
    portion: initialValues?.portion ?? "",
    calories: initialValues?.calories ?? "",
  });
  // A field is only judged once visited, so a fresh form isn't covered in red.
  const [touched, setTouched] = useState(NO_TOUCHED);
  const [duplicate, setDuplicate] = useState<Food | null>(null);
  // An existing Food always opens in kcal; otherwise use the unit last chosen on this device.
  const [unit, setUnit] = useState<EnergyUnit>(() =>
    initialValues?.calories ? "kcal" : readEnergyUnit(),
  );

  // Labels give kJ; the app stores kcal. Convert before validating, and show what will be saved.
  const kilojoules = unit === "kj" ? parseKilojoules(values.calories) : null;
  const energyAsCalories =
    unit === "kj"
      ? kilojoules === null
        ? ""
        : String(kilojoulesToCalories(kilojoules))
      : values.calories;
  const parsed = parseFoodInput({ ...values, calories: energyAsCalories });
  const errors: FoodErrors = parsed.ok ? {} : { ...parsed.errors };
  if (unit === "kj") {
    // A valid kJ figure always converts to valid kcal, so only the kJ message can apply.
    if (kilojoules === null) {
      errors.calories = `Kilojoules must be a whole number from 0 to ${MAX_KILOJOULES.toLocaleString("en-AU")}`;
    } else {
      errors.calories = undefined;
    }
  }
  const shown = (field: keyof FoodFormValues) =>
    touched[field] ? errors[field] : undefined;

  const set = (field: keyof FoodFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setDuplicate(null);
  };
  // Carry the number across when the unit changes, if there is a usable one to carry.
  function chooseUnit(next: EnergyUnit) {
    if (next === unit) return;
    const text = values.calories.trim();
    let converted = values.calories;
    if (unit === "kcal" && /^[0-9]+$/.test(text)) {
      converted = String(caloriesToKilojoules(Number(text)));
    } else if (unit === "kj") {
      const kj = parseKilojoules(text);
      if (kj !== null) converted = String(kilojoulesToCalories(kj));
    }
    setValues((current) => ({ ...current, calories: converted }));
    setUnit(next);
    saveEnergyUnit(next);
  }
  const visit = (field: keyof FoodFormValues) => () =>
    setTouched((current) => ({ ...current, [field]: true }));

  // Returns the checked Food, or null after surfacing whatever is wrong with it.
  function check(): FoodInput | null {
    setTouched({ name: true, portion: true, calories: true });
    if (!parsed.ok) return null;
    const existing = findExisting?.(parsed.value);
    if (existing) {
      setDuplicate(existing);
      return null;
    }
    return parsed.value;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const food = check();
    if (food) onSubmit(food);
  }

  function submitAnother() {
    const food = check();
    if (!food) return;
    onSubmitAnother?.(food);
    // Keep the Portion: foods added in a row often share one.
    setValues((current) => ({ ...current, name: "", calories: "" }));
    setTouched(NO_TOUCHED);
    nameRef.current?.focus();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {sourceLabel ? (
        <p className="text-muted-foreground text-sm">{sourceLabel}</p>
      ) : null}
      <Field
        id={`${id}-name`}
        label="Name"
        value={values.name}
        error={shown("name")}
        onChange={set("name")}
        onBlur={visit("name")}
        inputRef={nameRef}
        enterKeyHint="next"
        autoFocus
      />
      <div className="flex flex-col gap-2">
        <Field
          id={`${id}-portion`}
          label="Portion"
          value={values.portion}
          error={shown("portion")}
          onChange={set("portion")}
          onBlur={visit("portion")}
          enterKeyHint="next"
        />
        <PortionChips portion={values.portion} onPick={set("portion")} />
      </div>
      <div className="flex flex-col gap-2">
        <Field
          id={`${id}-calories`}
          label={unit === "kj" ? "Kilojoules" : "Calories"}
          value={values.calories}
          error={shown("calories")}
          onChange={set("calories")}
          onBlur={visit("calories")}
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="done"
        />
        <div className="flex items-center justify-between gap-3">
          <EnergyUnitToggle unit={unit} onChange={chooseUnit} />
          {kilojoules !== null ? (
            <p aria-live="polite" className="text-muted-foreground text-sm">
              = {kilojoulesToCalories(kilojoules)} kcal
            </p>
          ) : null}
        </div>
      </div>
      {duplicate ? (
        <div className="flex flex-col items-start text-destructive text-sm">
          <p>
            You already have {duplicate.name} ({duplicate.portion})
          </p>
          {onEditExisting ? (
            <button
              type="button"
              onClick={() => onEditExisting(duplicate)}
              className="min-h-11 font-medium underline"
            >
              Edit {duplicate.name}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button type="submit" className="h-12 w-full text-base">
          {submitLabel}
        </Button>
        {onSubmitAnother ? (
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full text-base"
            onClick={submitAnother}
          >
            Save and add another
          </Button>
        ) : null}
      </div>
    </form>
  );
}
