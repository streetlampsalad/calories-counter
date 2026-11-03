export type HealthPayload = { status: "ok"; commit: string };

// COMMIT_SHA is passed by the deploy workflow (`vercel deploy --env`). Vercel's own
// VERCEL_GIT_COMMIT_SHA is absent from prebuilt deployments.
export function healthPayload(
  env: Record<string, string | undefined>,
): HealthPayload {
  return { status: "ok", commit: env.COMMIT_SHA || "unknown" };
}
