import { type FeedbackSet, parseSets, type Stage } from "./domain";
import type { FeatureIssues } from "./feature-issues";
import { FOLLOW_UP_LABELS, followUpBody, followUpTitle } from "./issue-body";

export type FeedbackResult =
  | { ok: true }
  | { ok: false; code: "not_allowed" | "invalid" | "limit" | "unavailable" };

export type StartedRound = {
  roundId: string;
  round: number;
  goal: string;
  featureIssue: number;
  previous: RequestBefore;
};

// What the request was before its Round started, so an undo can put it back.
export type RequestBefore = {
  stage: Stage;
  stageChangedAt: string;
  latestComment: string | null;
  readyNote: string | null;
};

export type FeedbackDeps = {
  userId: () => Promise<string | null>;
  /**
   * Starts a Round on the caller's own request and puts it back at Submitted, in one transaction
   * that checks it may have one and counts the caller's open requests. Null when it may not;
   * "invalid" when the database refuses the sets (it counts characters as code points).
   */
  startRound: (
    id: string,
    userId: string,
    sets: FeedbackSet[],
  ) => Promise<StartedRound | "limit" | "invalid" | null>;
  setRoundIssue: (roundId: string, number: number) => Promise<void>;
  /** Deletes the Round and puts the request back as it was, together. */
  undoRound: (roundId: string, before: RequestBefore) => Promise<void>;
  issues: FeatureIssues;
  log: (message: string, error: unknown) => void;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_ALLOWED = { ok: false, code: "not_allowed" } as const;
const UNAVAILABLE = { ok: false, code: "unavailable" } as const;

// Starts another Round (spec 135 US1) with the Requester's feedback sets (spec 193): the Round is
// recorded first, then its one follow-up Feature Issue is created. Either both exist or neither
// does, as when a request is submitted.
export async function giveFeedback(
  input: unknown,
  deps: FeedbackDeps,
): Promise<FeedbackResult> {
  const { id, sets, feedback } = (input ?? {}) as {
    id?: unknown;
    sets?: unknown;
    feedback?: unknown;
  };
  if (typeof id !== "string" || !UUID.test(id)) return NOT_ALLOWED;
  const userId = await deps.userId();
  if (!userId) return NOT_ALLOWED;

  // A tab left open on the client before spec 193 still sends one feedback string (FR-006).
  const parsed = parseSets(
    sets === undefined && typeof feedback === "string"
      ? [{ category: "enhancement", text: feedback }]
      : sets,
  );
  if (!parsed.ok) return { ok: false, code: "invalid" };

  let started: StartedRound | "limit" | "invalid" | null;
  try {
    started = await deps.startRound(id, userId, parsed.value);
  } catch (error) {
    deps.log(`could not start a Round on request ${id}`, error);
    return UNAVAILABLE;
  }
  if (started === null) return NOT_ALLOWED;
  if (started === "limit") return { ok: false, code: "limit" };
  if (started === "invalid") return { ok: false, code: "invalid" };
  const round = started;
  const undo = () =>
    deps
      .undoRound(round.roundId, round.previous)
      .catch((error) =>
        deps.log(
          `could not undo Round ${round.roundId} of request ${id}`,
          error,
        ),
      );

  let number: number;
  try {
    ({ number } = await deps.issues.create({
      title: followUpTitle(round.goal),
      body: followUpBody({
        id,
        goal: round.goal,
        sets: parsed.value,
        featureIssue: round.featureIssue,
        round: round.round,
      }),
      labels: FOLLOW_UP_LABELS,
    }));
  } catch (error) {
    deps.log("could not create the follow-up Feature Issue", error);
    await undo();
    return UNAVAILABLE;
  }

  try {
    await deps.setRoundIssue(round.roundId, number);
  } catch (error) {
    deps.log(
      `created Feature Issue #${number} but could not record it on Round ${round.roundId}`,
      error,
    );
    await deps.issues
      .close(number, "Not recorded in the app; please send the feedback again.")
      .catch(() => {});
    await undo();
    return UNAVAILABLE;
  }

  return { ok: true };
}
