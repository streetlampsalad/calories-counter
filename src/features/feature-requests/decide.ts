import type { Decision } from "./domain";
import type { FeatureIssues } from "./feature-issues";
import { cleanupChore } from "./issue-body";

export type DecideResult =
  | { ok: true }
  | { ok: false; code: "not_allowed" | "unavailable" };

export type DecideDeps = {
  toggleOn: () => Promise<boolean>;
  userId: () => Promise<string | null>;
  /**
   * The caller's own request, if it may be decided now: not withdrawn, not decided, Ready to try
   * (or its last Round declined) and its Toggle in Testing. Null otherwise.
   */
  find: (
    id: string,
    userId: string,
  ) => Promise<{ featureIssue: number } | null>;
  /**
   * Takes the Toggle out of Testing and records the decision and its Chore, in one transaction
   * that checks everything again. False, changing nothing, when it may not.
   */
  record: (
    id: string,
    userId: string,
    decision: Decision,
    cleanupIssue: number,
  ) => Promise<boolean>;
  /** The Chore recorded on the request, to tell whether a failed record landed after all. */
  recordedChore: (id: string) => Promise<number | null>;
  issues: FeatureIssues;
  log: (message: string, error: unknown) => void;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_ALLOWED = { ok: false, code: "not_allowed" } as const;
const UNAVAILABLE = { ok: false, code: "unavailable" } as const;

// It's ready (spec 135 US2). The clean-up Chore is created first and the Toggle's state changed
// second (D4): a Toggle cannot go back to Testing, so it must never leave Testing without its
// Chore. If the state change does not happen, the Chore is closed again, so no agent deletes the
// checks of a feature still being tried.
export async function decide(
  input: unknown,
  decision: Decision,
  deps: DecideDeps,
): Promise<DecideResult> {
  const id = (input as { id?: unknown } | null)?.id;
  if (typeof id !== "string" || !UUID.test(id)) return NOT_ALLOWED;
  if (!(await deps.toggleOn())) return NOT_ALLOWED;
  const userId = await deps.userId();
  if (!userId) return NOT_ALLOWED;

  let request: { featureIssue: number } | null;
  try {
    request = await deps.find(id, userId);
  } catch (error) {
    deps.log(`could not read request ${id}`, error);
    return UNAVAILABLE;
  }
  if (!request) return NOT_ALLOWED;

  let number: number;
  try {
    ({ number } = await deps.issues.create(
      cleanupChore(decision, request.featureIssue),
    ));
  } catch (error) {
    deps.log("could not create the clean-up Chore", error);
    return UNAVAILABLE;
  }

  const close = (comment: string) =>
    deps.issues
      .close(number, comment)
      .catch((error) =>
        deps.log(`could not close clean-up Chore #${number}`, error),
      );

  let recorded: boolean;
  try {
    recorded = await deps.record(id, userId, decision, number);
  } catch (error) {
    deps.log(`could not record the decision on request ${id}`, error);
    const landed = await deps.recordedChore(id).catch(() => null);
    if (landed === number) return { ok: true };
    await close("Not recorded in the app; the Toggle is still in Testing.");
    return UNAVAILABLE;
  }
  if (!recorded) {
    await close("The Toggle was no longer in Testing.");
    return NOT_ALLOWED;
  }
  return { ok: true };
}
