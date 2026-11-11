"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NotifyOffer } from "@/features/reminders/notify-offer";
import {
  countOpen,
  type FeatureRequestInput,
  MAX_OPEN,
  parseFeatureRequest,
  wantsMoreDetail,
} from "./domain";
import { useMyFeatureRequests, useSubmitFeatureRequest } from "./queries";

const LIST = "/settings/feature-requests";
type Field = keyof FeatureRequestInput;

// The form for a new Feature Request (spec 124 US1). Short on purpose, but it nudges for detail,
// because a fuller request gets a closer result.
export function RequestForm() {
  const router = useRouter();
  const { data: requests } = useMyFeatureRequests();
  const submit = useSubmitFeatureRequest();
  const [values, setValues] = useState({ goal: "", problem: "", details: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  if (requests && countOpen(requests) >= MAX_OPEN) {
    return (
      <div className="flex flex-col gap-4">
        <p>
          You can have {MAX_OPEN} requests at a time while they're being worked
          on. Once one is ready to try, you can ask for something else.
        </p>
        <Link
          href={LIST}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Back to your requests
        </Link>
      </div>
    );
  }

  function change(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field])
      setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseFeatureRequest(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    submit.mutate(values, {
      onSuccess: () => router.push(LIST),
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">
        Your request is posted publicly on GitHub, where the agents that build
        it read it. Don't include anything personal.
      </p>

      <TextField
        label="What would you like to be able to do?"
        hint="For example: “Log a meal I eat often with one tap”, or “See how much water I drink each day”."
        value={values.goal}
        error={errors.goal}
        onChange={(value) => change("goal", value)}
        required
      />
      <TextField
        label="What's getting in the way today? (optional)"
        hint="What's slow, fiddly or impossible now, and when you run into it."
        value={values.problem}
        error={errors.problem}
        onChange={(value) => change("problem", value)}
      />
      <TextField
        label="Anything else? (optional)"
        hint="How you'd know it works, things it shouldn't do, or apps that do it well."
        value={values.details}
        error={errors.details}
        onChange={(value) => change("details", value)}
      />

      {wantsMoreDetail(values) ? (
        <p className="text-muted-foreground text-sm">
          More detail means a closer result: say what you'd tap, what you'd see,
          and why it matters to you.
        </p>
      ) : null}

      <NotifyOffer
        label="Notify me when it's ready"
        hint="We'll send a notification when your feature is ready to try."
        granted="You'll get a notification when it's ready to try."
      />

      <Button type="submit" size="lg" disabled={submit.isPending}>
        {submit.isPending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}

function TextField({
  label,
  hint,
  value,
  error,
  onChange,
  required = false,
}: {
  label: string;
  hint: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-medium text-base">
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        className="min-h-24"
      />
      {error ? (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <p id={hintId} className="text-muted-foreground text-sm">
        {hint}
      </p>
    </div>
  );
}
