import { z } from "zod";

// The Bug report form's fields and limits (spec 194 FR-002).
export const WENT_WRONG_MIN = 10;
export const WENT_WRONG_MAX = 2000;
export const EXPECTED_MAX = 2000;
export const HOW_MAX = 4000;
// At most this many Bug reports per User in any 24 hours (spec 194 D10).
export const DAILY_LIMIT = 5;

export const SCREENS = [
  "today",
  "foods",
  "summary",
  "settings",
  "other",
] as const;
export type Screen = (typeof SCREENS)[number];
export const SCREEN_LABELS: Record<Screen, string> = {
  today: "Today",
  foods: "Foods",
  summary: "Summary",
  settings: "Settings",
  other: "Somewhere else",
};

export const SEVERITIES = ["blocked", "annoying"] as const;
export type Severity = (typeof SEVERITIES)[number];
// `label` is what the form says; `issueText` is the Bug template's option text (3-bug.yml), which
// /deliver reads under `### How bad is it`. P0 is not offered (spec 194 D6).
export const SEVERITY_OPTIONS: Record<
  Severity,
  { label: string; issueText: string }
> = {
  blocked: {
    label: "I can't finish what I was doing",
    issueText: "A User cannot finish a main task (P1)",
  },
  annoying: {
    label: "It's annoying, but I can work around it",
    issueText: "Annoying, with a workaround (P2)",
  },
};

export type BugReportInput = {
  whatWentWrong: string;
  expected?: string;
  howItHappened?: string;
  screen?: Screen;
  severity: Severity;
};

type Field = keyof BugReportInput;

const WENT_WRONG_MESSAGE = "Say what went wrong, in at least 10 characters.";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => value || undefined);

const schema = z.object({
  whatWentWrong: z
    .string(WENT_WRONG_MESSAGE)
    .trim()
    .min(WENT_WRONG_MIN, WENT_WRONG_MESSAGE)
    .max(WENT_WRONG_MAX, "Keep this under 2,000 characters."),
  expected: optionalText(EXPECTED_MAX, "Keep this under 2,000 characters."),
  howItHappened: optionalText(HOW_MAX, "Keep this under 4,000 characters."),
  screen: z
    .union([z.enum(SCREENS), z.literal("")])
    .optional()
    .transform((value) => value || undefined),
  severity: z.enum(SEVERITIES, "Choose how bad it is."),
});

export type ParseResult =
  | { ok: true; value: BugReportInput }
  | { ok: false; errors: Partial<Record<Field, string>> };

// Checked in the browser for the form's messages, and again in the server action.
export function parseBugReport(input: unknown): ParseResult {
  const result = schema.safeParse(input ?? {});
  if (result.success) {
    const { whatWentWrong, expected, howItHappened, screen, severity } =
      result.data;
    return {
      ok: true,
      value: {
        whatWentWrong,
        ...(expected ? { expected } : {}),
        ...(howItHappened ? { howItHappened } : {}),
        ...(screen ? { screen } : {}),
        severity,
      },
    };
  }

  const errors: Partial<Record<Field, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as Field | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  if (Object.keys(errors).length === 0)
    errors.whatWentWrong = WENT_WRONG_MESSAGE;
  return { ok: false, errors };
}
