import { z } from "zod";
import { sameSecret } from "@/features/reminders/send-handler";
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

export type SyncDeps = {
  /** The shared secret. Missing or empty means every call is refused. */
  secret: string | undefined;
  apply: (updates: StageUpdate[]) => Promise<SyncedRequest[]>;
};

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

  return reply(200, { updated: synced.length, notified: 0 });
}
