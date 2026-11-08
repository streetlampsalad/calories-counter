import type { FeatureIssues } from "./feature-issues";

export type WithdrawResult =
  | { ok: true }
  | { ok: false; code: "not_allowed" | "unavailable" };

export type WithdrawDeps = {
  toggleOn: () => Promise<boolean>;
  userId: () => Promise<string | null>;
  /**
   * Marks the caller's own request withdrawn, in one update that also checks it is still at
   * Submitted, Being reviewed or Planning and not withdrawn. Null when nothing matched.
   */
  markWithdrawn: (
    id: string,
    userId: string,
  ) => Promise<{
    featureIssue: number | null;
    specIssue: number | null;
  } | null>;
  unmarkWithdrawn: (id: string) => Promise<void>;
  issues: FeatureIssues;
  log: (message: string, error: unknown) => void;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMENT = "Withdrawn by the requester.";
const NOT_ALLOWED = { ok: false, code: "not_allowed" } as const;

// Withdraws a request before building starts (spec 124 US4). The request is marked first, so a sync
// arriving meanwhile is ignored and notifies nobody; if GitHub then fails, the mark is cleared, so
// the app never says Withdrawn while agents keep working on it.
export async function withdrawFeatureRequest(
  input: unknown,
  deps: WithdrawDeps,
): Promise<WithdrawResult> {
  const id = (input as { id?: unknown } | null)?.id;
  if (typeof id !== "string" || !UUID.test(id)) return NOT_ALLOWED;
  if (!(await deps.toggleOn())) return NOT_ALLOWED;
  const userId = await deps.userId();
  if (!userId) return NOT_ALLOWED;

  let marked: Awaited<ReturnType<WithdrawDeps["markWithdrawn"]>>;
  try {
    marked = await deps.markWithdrawn(id, userId);
  } catch (error) {
    deps.log("could not withdraw a Feature Request", error);
    return { ok: false, code: "unavailable" };
  }
  if (!marked) return NOT_ALLOWED;

  try {
    for (const number of [marked.featureIssue, marked.specIssue])
      if (number) await deps.issues.close(number, COMMENT);
  } catch (error) {
    deps.log(`could not close the Issues of withdrawn request ${id}`, error);
    await deps.unmarkWithdrawn(id).catch(() => {});
    return { ok: false, code: "unavailable" };
  }
  return { ok: true };
}
