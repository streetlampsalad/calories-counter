import { z } from "zod";

// Every part of Feature Requests sits behind this Toggle (spec 124, ADR 0008).
export const FEATURE_REQUESTS_TOGGLE = "feature-114";

// The repository each Feature Request becomes a Feature Issue on. It is public.
export const REPOSITORY = "streetlampsalad/calories-counter";

export const STAGES = [
  "submitted",
  "being_reviewed",
  "planning",
  "building",
  "waiting_for_owner",
  "ready_to_try",
  "not_going_ahead",
] as const;
export type Stage = (typeof STAGES)[number];

// Stages where agents are still working: a User may have at most MAX_OPEN of these at once.
export const OPEN_STAGES: readonly Stage[] = [
  "submitted",
  "being_reviewed",
  "planning",
  "building",
  "waiting_for_owner",
];
export const MAX_OPEN = 2;

export const GOAL_MIN = 10;
export const GOAL_MAX = 2000;
export const OTHER_MAX = 4000;
// Below this many characters in all, the form gently asks for more detail (it never blocks).
export const DETAIL_PROMPT_BELOW = 100;

export type FeatureRequestInput = {
  goal: string;
  problem?: string;
  details?: string;
};

type Field = keyof FeatureRequestInput;

const optional = z
  .string()
  .trim()
  .max(OTHER_MAX, "Keep this under 4,000 characters.")
  .optional()
  .transform((value) => value || undefined);

const schema = z.object({
  goal: z
    .string("Say what you'd like to be able to do, in at least 10 characters.")
    .trim()
    .min(
      GOAL_MIN,
      "Say what you'd like to be able to do, in at least 10 characters.",
    )
    .max(GOAL_MAX, "Keep this under 2,000 characters."),
  problem: optional,
  details: optional,
});

export type ParseResult =
  | { ok: true; value: FeatureRequestInput }
  | { ok: false; errors: Partial<Record<Field, string>> };

// Checked in the browser for the form's messages, and again in the server action.
export function parseFeatureRequest(input: unknown): ParseResult {
  const result = schema.safeParse(input ?? {});
  if (result.success) return { ok: true, value: result.data };

  const errors: Partial<Record<Field, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as Field | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  if (Object.keys(errors).length === 0)
    errors.goal =
      "Say what you'd like to be able to do, in at least 10 characters.";
  return { ok: false, errors };
}

// Feedback that starts a Round (spec 135 US1.2).
export const FEEDBACK_MIN = 10;
export const FEEDBACK_MAX = 4000;
const FEEDBACK_SHORT = "Say what should change, in at least 10 characters.";

const feedbackSchema = z
  .string(FEEDBACK_SHORT)
  .trim()
  .min(FEEDBACK_MIN, FEEDBACK_SHORT)
  .max(FEEDBACK_MAX, "Keep this under 4,000 characters.");

// Checked in the sheet for its message, and again in the server action.
export function parseFeedback(
  input: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  const result = feedbackSchema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: result.error.issues[0]?.message ?? FEEDBACK_SHORT };
}

export function wantsMoreDetail(input: Partial<FeatureRequestInput>): boolean {
  const total =
    (input.goal?.trim().length ?? 0) +
    (input.problem?.trim().length ?? 0) +
    (input.details?.trim().length ?? 0);
  return total < DETAIL_PROMPT_BELOW;
}

export function countOpen(
  requests: { stage: Stage; withdrawnAt: string | null }[],
): number {
  return requests.filter(
    (request) =>
      request.withdrawnAt === null && OPEN_STAGES.includes(request.stage),
  ).length;
}

// What a Requester decides about a feature they have tried (spec 135): It's ready turns its Toggle
// Live for everyone.
export type Decision = "ready";
