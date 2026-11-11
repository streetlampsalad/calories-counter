import { z } from "zod";
import {
  notify,
  type PushTarget,
  shortGoal,
} from "@/features/feature-requests/sync-handler";
import { type SendResult, sameSecret } from "@/features/reminders/send-handler";
import { OUTCOMES } from "./outcome";

// One Bug report's outcome as the board's sync worked it out (scripts/workflow/bug-reports-sync.mjs).
const updateSchema = z.object({
  id: z.uuid(),
  bug_issue: z.number().int().positive(),
  outcome: z.enum(OUTCOMES),
  issue_title: z.string(),
  latest_comment: z.string().nullable(),
});
const bodySchema = z.object({ updates: z.array(updateSchema).max(500) });

export type OutcomeUpdate = z.infer<typeof updateSchema>;

// A Bug report whose outcome just changed into Fixed or Not going ahead, as apply_bug_report_sync
// returns it.
export type ChangedReport = {
  id: string;
  user_id: string;
  new_outcome: string;
  issue_title: string | null;
  latest_comment: string | null;
};

export type SyncDeps = {
  /** The shared secret. Missing or empty means every call is refused. */
  secret: string | undefined;
  apply: (updates: OutcomeUpdate[]) => Promise<ChangedReport[]>;
  devices: (userIds: string[]) => Promise<PushTarget[]>;
  send: (target: PushTarget, payload: string) => Promise<SendResult>;
  deleteSubscriptions: (ids: string[]) => Promise<void>;
};

// What the User's phone shows (US3.7). Tapping it opens the report in the list.
export function notificationFor(report: ChangedReport) {
  const title = report.issue_title
    ? shortGoal(report.issue_title)
    : "Your bug report";
  return {
    title: `${report.new_outcome === "fixed" ? "Fixed" : "Not going ahead"}: ${title}`,
    body: report.latest_comment?.slice(0, 120) || "Open it to see why.",
    url: `/settings/report-a-bug#${report.id}`,
  };
}

const reply = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Called only by the board workflow, with the shared secret in `x-sync-secret` (spec 194 US3.3, US3.4).
export async function handleBugReportSync(request: Request, deps: SyncDeps) {
  const given = request.headers.get("x-sync-secret") ?? "";
  if (!deps.secret || !given || !sameSecret(given, deps.secret)) {
    return reply(401, { code: "unauthorized" });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return reply(400, { code: "invalid" });
  }

  let changed: ChangedReport[];
  try {
    changed = await deps.apply(body.updates);
  } catch (error) {
    console.error("could not record Bug report outcomes", error);
    return reply(500, { code: "unavailable" });
  }

  const notified = await notify(
    changed.map((report) => ({
      requesterId: report.user_id,
      payload: JSON.stringify(notificationFor(report)),
    })),
    deps,
  );

  return reply(200, { applied: body.updates.length, notified });
}
