// Pure rules for Feature Requests (specs/124-feature-requests/): which Feature Issues came from the
// app, which stage each one's Issue tree is at, and how that reaches the app. The sync is a
// projection, like the board: re-running it always gives the same answer.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVIEW = "needs-human-review";
const CLAIM = "Claimed by /deliver";
const COMMENT_MAX = 200;
const NOTE_MAX = 2000;

/** The Feature Request id under a Feature's `### Requested by`, or null for any other Feature. */
export function requestedBy(body) {
  const match = (body ?? "").match(
    /^### Requested by[ \t]*\r?\n([\s\S]*?)(?=^### |(?![\s\S]))/m,
  );
  const value = match?.[1].trim().split(/\r?\n/)[0]?.trim() ?? "";
  return UUID.test(value) ? value.toLowerCase() : null;
}

/**
 * @typedef {{ state: "open" | "closed", stateReason: string | null, labels: string[], assigned: boolean }} FeatureFacts
 * @typedef {{ state: "open" | "closed", stateReason: string | null, labels: string[], subIssues: { state: string, labels: string[] }[] }} SpecFacts
 * @typedef {{ feature: FeatureFacts, spec: SpecFacts | null, openPullLabels: string[][] }} RequestTree
 */

/** The stage a Feature Request is at, from its Feature, Spec, Slices and open pull requests (US2.1). */
export function stageFor(
  /** @type {RequestTree} */ { feature, spec, openPullLabels },
) {
  if (feature.state === "closed")
    return feature.stateReason === "not_planned"
      ? "not_going_ahead"
      : "ready_to_try";
  if (spec?.state === "closed" && spec.stateReason !== "not_planned")
    return "ready_to_try";

  const openSlices = (spec?.subIssues ?? []).filter(
    (slice) => slice.state === "open",
  );
  const waiting =
    feature.labels.includes(REVIEW) ||
    spec?.labels.includes(REVIEW) ||
    openSlices.some((slice) => slice.labels.includes(REVIEW)) ||
    openPullLabels.some((labels) => labels.includes(REVIEW));
  if (waiting) return "waiting_for_owner";

  if (spec && spec.subIssues.length > 0) return "building";
  if (spec) return "planning";
  if (feature.assigned || !feature.labels.includes("needs-triage"))
    return "being_reviewed";
  return "submitted";
}

/** The first line of the newest comment that says something, for the request's card. */
export function latestComment(comments) {
  const newest = [...comments]
    .filter((comment) => !comment.body.trim().startsWith(CLAIM))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const comment of newest) {
    const line = comment.body
      .split(/\r?\n/)
      // Quote, heading and list markers only, so **bold** survives.
      .map((text) =>
        text.replace(/^(?:\s*(?:>|#{1,6}(?=\s)|[-*](?=\s)))+/, "").trim(),
      )
      .find(Boolean);
    if (line) return line.slice(0, COMMENT_MAX);
  }
  return null;
}

/** A spec's `## Ready to try` section: what the Requester will find and how to try it. */
export function readyNote(specMarkdown) {
  const match = (specMarkdown ?? "").match(
    /^## Ready to try[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m,
  );
  const note = match?.[1].trim();
  return note ? note.slice(0, NOTE_MAX) : null;
}

/**
 * Posts every request's stage to the app. Skips with a warning while the app is not set up for it
 * yet (no secret or address, or the route not deployed), so the board never fails in that gap.
 */
export async function sendSync({
  url,
  secret,
  requests,
  fetchImpl = fetch,
  warn = (message) => console.log(`::warning::${message}`),
}) {
  if (!secret || !url) {
    warn(
      "FEATURE_REQUESTS_SYNC_SECRET or PRODUCTION_URL is not set, so Feature Requests were not synced. Run scripts/setup-feature-requests.sh.",
    );
    return "skipped";
  }
  const response = await fetchImpl(`${url}/api/feature-requests/sync`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sync-secret": secret },
    body: JSON.stringify({ requests }),
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) {
    warn(
      "The app has no Feature Requests sync route yet, so nothing was synced.",
    );
    return "skipped";
  }
  if (!response.ok)
    throw new Error(
      `The app answered ${response.status} to the Feature Requests sync`,
    );
  return "sent";
}
