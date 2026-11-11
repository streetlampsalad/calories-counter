"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NotifyOffer } from "@/features/reminders/notify-offer";
import { useToggles } from "@/features/toggles/queries";
import {
  APP_VERSION_LABEL,
  DEVICE_LINES,
  type Device,
  describeDevice,
} from "./device";
import {
  type BugReportInput,
  DAILY_LIMIT,
  parseBugReport,
  SCREEN_LABELS,
  SCREENS,
  SEVERITIES,
  SEVERITY_OPTIONS,
} from "./domain";
import { useSendBugReport, useSentToday } from "./queries";

type Field = keyof BugReportInput;
const EMPTY = {
  whatWentWrong: "",
  expected: "",
  howItHappened: "",
  screen: "",
  severity: "",
};

// The form for a Bug report (spec 194 US1). `version` is the app version the server will add to the
// Issue, shown with the Toggles so the User sees exactly what is attached (FR-007).
export function BugReportForm({ version }: { version: string }) {
  const { data: sentToday } = useSentToday();
  const send = useSendBugReport();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [sent, setSent] = useState<{ issue: number; url: string } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // Described after mount, since the server can't know it. Undefined while pending, null when it
  // couldn't be described (the report is then sent without it).
  const [device, setDevice] = useState<Device | null>();

  useEffect(() => {
    let current = true;
    describeDevice(navigator, window)
      .then((described) => {
        if (current) setDevice(described);
      })
      .catch(() => {
        if (current) setDevice(null);
      });
    return () => {
      current = false;
    };
  }, []);

  function change(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field])
      setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseBugReport(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setFailure(null);
    send.mutate(
      { ...(values as BugReportInput), ...(device ? { device } : {}) },
      {
        onSuccess: (result) => {
          setSent(result);
          setValues(EMPTY);
          setErrors({});
        },
        onError: (error) => setFailure(error.message),
      },
    );
  }

  const limited = sentToday !== undefined && sentToday >= DAILY_LIMIT;

  return (
    <div className="flex flex-col gap-5">
      {sent ? (
        <output className="flex flex-col gap-1">
          <span className="font-medium">Sent</span>
          <a
            href={sent.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center underline"
          >
            See it on GitHub as #{sent.issue}
          </a>
        </output>
      ) : null}

      {limited ? (
        <p>
          You can send {DAILY_LIMIT} bug reports a day, and you've sent{" "}
          {DAILY_LIMIT}. Try again later.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <p className="text-muted-foreground text-sm">
            Your report is posted publicly on GitHub, where the agents that fix
            it read it. Don't include anything personal.
          </p>
          <p className="text-muted-foreground text-sm">
            If it's a problem with a feature you're trying, use Give feedback on
            its request instead.
          </p>

          <TextField
            label="What went wrong?"
            hint="Say what you saw, in at least 10 characters."
            value={values.whatWentWrong}
            error={errors.whatWentWrong}
            onChange={(value) => change("whatWentWrong", value)}
            required
          />
          <TextField
            label="What did you expect? (optional)"
            value={values.expected}
            error={errors.expected}
            onChange={(value) => change("expected", value)}
          />
          <TextField
            label="How did it happen? (optional)"
            hint="The steps, if you remember them."
            value={values.howItHappened}
            error={errors.howItHappened}
            onChange={(value) => change("howItHappened", value)}
          />

          <ScreenField
            value={values.screen}
            onChange={(value) => change("screen", value)}
          />
          <SeverityField
            value={values.severity}
            error={errors.severity}
            onChange={(value) => change("severity", value)}
          />

          <Attached version={version} device={device} />

          <NotifyOffer
            label="Notify me about this report"
            hint="We'll send a notification when it's fixed or turned down."
            granted="You'll get a notification when it's fixed or turned down."
          />

          {failure ? (
            <p role="alert" className="text-destructive text-sm">
              {failure}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="h-12 text-base"
            disabled={send.isPending}
          >
            {send.isPending ? "Sending…" : "Send report"}
          </Button>
        </form>
      )}
    </div>
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
  hint?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

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
        aria-describedby={describedBy || undefined}
        className="min-h-24"
      />
      {error ? (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ScreenField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-medium text-base">
        Where in the app was it? (optional)
      </Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base dark:bg-input/30"
      >
        <option value="">Not sure</option>
        {SCREENS.map((screen) => (
          <option key={screen} value={screen}>
            {SCREEN_LABELS[screen]}
          </option>
        ))}
      </select>
    </div>
  );
}

function SeverityField({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-medium text-base">How bad is it?</legend>
      {SEVERITIES.map((severity) => (
        <label
          key={severity}
          className="flex min-h-12 items-center gap-3 text-base"
        >
          <input
            type="radio"
            name="severity"
            value={severity}
            checked={value === severity}
            onChange={() => onChange(severity)}
            className="size-5 accent-primary"
          />
          {SEVERITY_OPTIONS[severity].label}
        </label>
      ))}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </fieldset>
  );
}

// Exactly what the app adds to the Issue besides the User's words (spec 194 FR-007).
function Attached({
  version,
  device,
}: {
  version: string;
  device: Device | null | undefined;
}) {
  const { data, isPending, isError } = useToggles();
  const on = [
    ...(data ?? []).filter(
      (toggle) => toggle.isOn && toggle.state === "testing",
    ),
    ...(data ?? []).filter((toggle) => toggle.isOn && toggle.state === "live"),
  ];

  return (
    <section
      aria-labelledby="attached-heading"
      className="flex flex-col gap-2 rounded-lg border p-3"
    >
      <h2 id="attached-heading" className="font-medium text-base">
        Attached to your report
      </h2>
      <p className="text-sm">
        {APP_VERSION_LABEL}: {version}
      </p>
      {device ? (
        DEVICE_LINES.map(({ key, label }) => (
          <p key={key} className="text-sm">
            {label}: {device[key]}
          </p>
        ))
      ) : device === null ? (
        <p className="text-sm">Device: Couldn't be read</p>
      ) : (
        <p className="text-sm">Checking…</p>
      )}
      <div className="flex flex-col gap-1">
        <h3 className="text-muted-foreground text-sm">Toggles</h3>
        {isPending ? (
          <p className="text-sm">Checking…</p>
        ) : isError ? (
          <p className="text-sm">Couldn't be read</p>
        ) : on.length === 0 ? (
          <p className="text-sm">No Toggles on</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {on.map((toggle) => (
              <li key={toggle.key}>
                {toggle.title} ({toggle.key}):{" "}
                {toggle.state === "testing" ? "Testing" : "Live"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
