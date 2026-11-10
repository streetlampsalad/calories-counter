import { REPOSITORY } from "@/features/feature-requests/domain";
import type { FeatureIssues } from "@/features/feature-requests/feature-issues";
import { parseBugReport } from "./domain";
import {
  BUG_LABELS,
  bugIssueBody,
  bugIssueTitle,
  type IssueToggle,
} from "./issue-body";

export type SendResult =
  | { ok: true; issue: number; url: string }
  | { ok: false; code: "not_found" | "invalid" | "limit" | "unavailable" };

export type SendDeps = {
  userId: () => Promise<string | null>;
  // Whether feature-192 is on for the caller (the action is reachable by a direct POST).
  toggleOn: () => Promise<boolean>;
  insert: (row: { user_id: string }) => Promise<{ id: string } | "limit">;
  setIssue: (id: string, number: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
  // The Toggles on for the caller, read with their session (spec 194 D13). Throws when unreadable.
  toggles: () => Promise<IssueToggle[]>;
  version: string;
  issues: FeatureIssues;
  log: (message: string, error: unknown) => void;
};

const UNAVAILABLE = { ok: false, code: "unavailable" } as const;

// Records the Bug report, then creates its public Bug Issue (spec 194 US1.6). Either both exist or
// neither does, so the app never shows a report agents can't see, nor GitHub an orphan Issue.
export async function sendBugReport(
  input: unknown,
  deps: SendDeps,
): Promise<SendResult> {
  const userId = await deps.userId();
  if (!userId || !(await deps.toggleOn()))
    return { ok: false, code: "not_found" };

  const parsed = parseBugReport(input);
  if (!parsed.ok) return { ok: false, code: "invalid" };

  let inserted: { id: string } | "limit";
  try {
    inserted = await deps.insert({ user_id: userId });
  } catch (error) {
    deps.log("could not store a Bug report", error);
    return UNAVAILABLE;
  }
  if (inserted === "limit") return { ok: false, code: "limit" };
  const { id } = inserted;

  let toggles: IssueToggle[] | null;
  try {
    toggles = await deps.toggles();
  } catch (error) {
    deps.log("could not read the Toggles for a Bug report", error);
    toggles = null;
  }

  let number: number;
  try {
    ({ number } = await deps.issues.create({
      title: bugIssueTitle(parsed.value.whatWentWrong),
      body: bugIssueBody({
        id,
        report: parsed.value,
        toggles,
        version: deps.version,
      }),
      labels: BUG_LABELS,
    }));
  } catch (error) {
    deps.log("could not create the Bug Issue", error);
    await deps.remove(id).catch(() => {});
    return UNAVAILABLE;
  }

  try {
    await deps.setIssue(id, number);
  } catch (error) {
    deps.log(
      `created Bug Issue #${number} but could not record it on Bug report ${id}`,
      error,
    );
    await deps.issues
      .close(
        number,
        "Couldn't be recorded by the app; the reporter was asked to try again.",
      )
      .catch(() => {});
    await deps.remove(id).catch(() => {});
    return UNAVAILABLE;
  }

  return {
    ok: true,
    issue: number,
    url: `https://github.com/${REPOSITORY}/issues/${number}`,
  };
}
