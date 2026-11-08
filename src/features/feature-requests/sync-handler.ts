import { z } from "zod";
import {
  type DueSubscription,
  type SendResult,
  sameSecret,
} from "@/features/reminders/send-handler";
import { STAGES } from "./domain";

// One request's stage as the board's sync worked it out (scripts/workflow/feature-requests-sync.mjs).
const updateSchema = z.object({
  featureIssue: z.number().int().positive(),
  stage: z.enum(STAGES),
  specIssue: z.number().int().positive().nullable(),
  latestComment: z.string().nullable(),
  readyNote: z.string().nullable(),
});
const bodySchema = z.object({ requests: z.array(updateSchema).max(200) });

export type StageUpdate = z.infer<typeof updateSchema>;

// A request the sync updated, as apply_feature_request_sync returns it.
export type SyncedRequest = {
  request_id: string;
  requester_id: string;
  goal_text: string;
  new_stage: string;
  comment: string | null;
  notify: boolean;
};

// One of a Requester's devices, as the Reminder sender takes it.
export type PushTarget = Omit<DueSubscription, "local_day">;

export type SyncDeps = {
  /** The shared secret. Missing or empty means every call is refused. */
  secret: string | undefined;
  apply: (updates: StageUpdate[]) => Promise<SyncedRequest[]>;
  devices: (userIds: string[]) => Promise<PushTarget[]>;
  send: (target: PushTarget, payload: string) => Promise<SendResult>;
  deleteSubscriptions: (ids: string[]) => Promise<void>;
};

const TITLE_GOAL_MAX = 60;

function shortGoal(goal: string): string {
  const line = (goal.trim().split(/\r?\n/)[0] ?? "").replace(/\s+/g, " ");
  if (line.length <= TITLE_GOAL_MAX) return line;
  const cut = line.slice(0, TITLE_GOAL_MAX - 1);
  const atWord =
    cut.lastIndexOf(" ") > 0 ? cut.slice(0, cut.lastIndexOf(" ")) : cut;
  return `${atWord.trimEnd()}…`;
}

// What the Requester's phone shows (US3.1, US3.2). Tapping it opens the request's card.
export function notificationFor(request: SyncedRequest) {
  const url = `/settings/feature-requests#${request.request_id}`;
  if (request.new_stage === "ready_to_try")
    return {
      title: `Ready to try: ${shortGoal(request.goal_text)}`,
      body: "Turn it on to try it.",
      url,
    };
  return {
    title: `Not going ahead: ${shortGoal(request.goal_text)}`,
    body: request.comment?.slice(0, 120) || "Open it to see why.",
    url,
  };
}

// Tells each Requester due a notification, on every device they subscribed. A failure here never
// undoes the stages already recorded; it is logged and the count says how many were reached.
async function notify(due: SyncedRequest[], deps: SyncDeps): Promise<number> {
  if (due.length === 0) return 0;
  let reached = 0;
  try {
    const devices = await deps.devices([
      ...new Set(due.map((r) => r.requester_id)),
    ]);
    const expired: string[] = [];
    for (const request of due) {
      const payload = JSON.stringify(notificationFor(request));
      let sent = false;
      for (const device of devices.filter(
        (d) => d.user_id === request.requester_id,
      )) {
        const result = await deps
          .send(device, payload)
          .catch(() => "failed" as const);
        if (result === "sent") sent = true;
        if (result === "expired") expired.push(device.subscription_id);
      }
      if (sent) reached += 1;
    }
    if (expired.length > 0) await deps.deleteSubscriptions(expired);
  } catch (error) {
    console.error("could not notify Feature Request Requesters", error);
  }
  return reached;
}

const reply = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Called only by the board workflow, with the shared secret in `x-sync-secret` (spec 124 US2.3).
export async function handleFeatureRequestSync(
  request: Request,
  deps: SyncDeps,
) {
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

  let synced: SyncedRequest[];
  try {
    synced = await deps.apply(body.requests);
  } catch (error) {
    console.error("could not record Feature Request stages", error);
    return reply(500, { code: "unavailable" });
  }

  const notified = await notify(
    synced.filter((request) => request.notify),
    deps,
  );
  return reply(200, { updated: synced.length, notified });
}
