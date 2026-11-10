import { z } from "zod";

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

// Feedback that starts a Round (spec 135 US1.2) comes in sets, each an enhancement or a bug
// (spec 193): 1 to MAX_SETS of them, each 10 to 4,000 characters.
export const FEEDBACK_MIN = 10;
export const FEEDBACK_MAX = 4000;
export const MAX_SETS = 5;
export const SET_CATEGORIES = ["enhancement", "bug"] as const;
export type FeedbackCategory = (typeof SET_CATEGORIES)[number];
export type FeedbackSet = { category: FeedbackCategory; text: string };

const setSchema = (n: number) =>
  z.object({
    category: z.enum(SET_CATEGORIES, `Set ${n}: choose Enhancement or Bug.`),
    text: z
      .string(`Set ${n}: say what should change, in at least 10 characters.`)
      .trim()
      .min(
        FEEDBACK_MIN,
        `Set ${n}: say what should change, in at least 10 characters.`,
      )
      .max(FEEDBACK_MAX, `Set ${n}: keep this under 4,000 characters.`),
  });

export type ParseSetsResult =
  | { ok: true; value: FeedbackSet[] }
  | { ok: false; errors: (string | undefined)[] };

// Checked in the sheet for each set's message, and again in the server action. `errors` has one
// entry per set, undefined for a set that is fine; it is empty when the list itself is wrong.
export function parseSets(input: unknown): ParseSetsResult {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_SETS)
    return { ok: false, errors: [] };

  const value: FeedbackSet[] = [];
  const errors = input.map((set, index) => {
    const result = setSchema(index + 1).safeParse(set);
    if (result.success) {
      value.push(result.data);
      return undefined;
    }
    return result.error.issues[0]?.message;
  });
  return errors.some(Boolean) ? { ok: false, errors } : { ok: true, value };
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
// Live for everyone, Remove it turns it off for everyone (Removed).
export type Decision = "ready" | "remove";
