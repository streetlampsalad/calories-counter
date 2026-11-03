"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Food, FoodInput } from "./types";
import {
  type FoodErrors,
  type FoodFormValues,
  parseFoodInput,
} from "./validation";

type Props = {
  initialValues?: Partial<FoodFormValues>;
  submitLabel?: string;
  /** The live Food that already uses this name and Portion, if any. */
  findExisting?: (input: FoodInput) => Food | undefined;
  onSubmit: (value: FoodInput) => void;
};

type FieldProps = {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<"input">, "id" | "value" | "onChange">;

function Field({
  id,
  label,
  value,
  error,
  onChange,
  ...inputProps
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
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

export function FoodForm({
  initialValues,
  submitLabel = "Save",
  findExisting,
  onSubmit,
}: Props) {
  const id = useId();
  const [values, setValues] = useState<FoodFormValues>({
    name: initialValues?.name ?? "",
    portion: initialValues?.portion ?? "",
    calories: initialValues?.calories ?? "",
  });
  const [errors, setErrors] = useState<FoodErrors>({});
  const [duplicate, setDuplicate] = useState<Food | null>(null);

  const set = (field: keyof FoodFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setDuplicate(null);
  };

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = parseFoodInput(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const existing = findExisting?.(result.value);
    if (existing) {
      setDuplicate(existing);
      return;
    }
    onSubmit(result.value);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field
        id={`${id}-name`}
        label="Name"
        value={values.name}
        error={errors.name}
        onChange={set("name")}
        enterKeyHint="next"
        autoFocus
      />
      <Field
        id={`${id}-portion`}
        label="Portion"
        value={values.portion}
        error={errors.portion}
        onChange={set("portion")}
        enterKeyHint="next"
      />
      <Field
        id={`${id}-calories`}
        label="Calories"
        value={values.calories}
        error={errors.calories}
        onChange={set("calories")}
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
      />
      {duplicate ? (
        <p className="text-destructive text-sm">
          You already have {duplicate.name} ({duplicate.portion})
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-full text-base">
        {submitLabel}
      </Button>
    </form>
  );
}
