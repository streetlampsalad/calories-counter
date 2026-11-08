import { parseFeatureRequest } from "./domain";
import type { FeatureIssues } from "./feature-issues";
import { ISSUE_LABELS, issueBody, issueTitle } from "./issue-body";

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; code: "not_found" | "invalid" | "limit" | "unavailable" };

export type SubmitDeps = {
  toggleOn: () => Promise<boolean>;
  userId: () => Promise<string | null>;
  insert: (row: {
    user_id: string;
    goal: string;
    problem: string | null;
    details: string | null;
  }) => Promise<{ id: string } | "limit">;
  setIssue: (id: string, number: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
  issues: FeatureIssues;
  log: (message: string, error: unknown) => void;
};

const UNAVAILABLE = { ok: false, code: "unavailable" } as const;

// Records the request, then creates its public Feature Issue (spec 124 US1.5). Either both exist
// or neither does, so the app never shows a request agents can't see, nor GitHub an orphan Issue.
export async function submitFeatureRequest(
  input: unknown,
  deps: SubmitDeps,
): Promise<SubmitResult> {
  if (!(await deps.toggleOn())) return { ok: false, code: "not_found" };
  const userId = await deps.userId();
  if (!userId) return { ok: false, code: "not_found" };

  const parsed = parseFeatureRequest(input);
  if (!parsed.ok) return { ok: false, code: "invalid" };
  const { goal, problem, details } = parsed.value;

  let inserted: { id: string } | "limit";
  try {
    inserted = await deps.insert({
      user_id: userId,
      goal,
      problem: problem ?? null,
      details: details ?? null,
    });
  } catch (error) {
    deps.log("could not store a Feature Request", error);
    return UNAVAILABLE;
  }
  if (inserted === "limit") return { ok: false, code: "limit" };
  const { id } = inserted;

  let number: number;
  try {
    ({ number } = await deps.issues.create({
      title: issueTitle(goal),
      body: issueBody({ id, goal, problem, details }),
      labels: ISSUE_LABELS,
    }));
  } catch (error) {
    deps.log("could not create the Feature Issue", error);
    await deps.remove(id).catch(() => {});
    return UNAVAILABLE;
  }

  try {
    await deps.setIssue(id, number);
  } catch (error) {
    deps.log(
      `created Feature Issue #${number} but could not record it on request ${id}`,
      error,
    );
    await deps.issues
      .close(number, "Not recorded in the app; please ask again.")
      .catch(() => {});
    await deps.remove(id).catch(() => {});
    return UNAVAILABLE;
  }

  return { ok: true, id };
}
