import { createHash, timingSafeEqual } from "node:crypto";

// One device due a Reminder, as `due_reminders` returns it.
export type DueSubscription = {
  user_id: string;
  /** The User's own Day, in their saved time zone. */
  local_day: string;
  subscription_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_secret: string;
};

// "expired" is the push service saying this device will never hear from us again (HTTP 404/410).
export type SendResult = "sent" | "expired" | "failed";

export const REMINDER_PAYLOAD = {
  title: "Nothing logged today",
  body: "Tap to log what you've eaten.",
  url: "/",
} as const;

type Deps = {
  /** The scheduler's shared secret. Missing or empty means every call is refused. */
  secret: string | undefined;
  now: () => Date;
  dueReminders: (at: Date) => Promise<DueSubscription[]>;
  send: (subscription: DueSubscription, payload: string) => Promise<SendResult>;
  deleteSubscriptions: (ids: string[]) => Promise<void>;
  markSent: (userId: string, localDay: string) => Promise<void>;
};

const reply = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Compares digests, so neither the secret's value nor its length shows in how long this takes.
export function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

// Called by the database's scheduler every 15 minutes (ADR 0005), never by a browser: it needs the
// shared secret in `x-scheduler-secret`. Sends the Reminder to every device of every User who is due.
export async function handleSendReminders(request: Request, deps: Deps) {
  const given = request.headers.get("x-scheduler-secret") ?? "";
  if (!deps.secret || !given || !sameSecret(given, deps.secret)) {
    return reply(401, { code: "unauthorized" });
  }

  let due: DueSubscription[];
  try {
    due = await deps.dueReminders(deps.now());
  } catch (error) {
    console.error("could not list due Reminders", error);
    return reply(500, { code: "unavailable" });
  }

  const payload = JSON.stringify(REMINDER_PAYLOAD);
  const expired: string[] = [];
  const reached = new Map<string, string>(); // user id -> the local Day it reached them for
  const users = new Set<string>();
  let sent = 0;
  let failed = 0;

  for (const subscription of due) {
    users.add(subscription.user_id);
    let result: SendResult;
    try {
      result = await deps.send(subscription, payload);
    } catch (error) {
      console.error("could not send a Reminder", error);
      result = "failed";
    }
    if (result === "sent") {
      sent += 1;
      reached.set(subscription.user_id, subscription.local_day);
    } else if (result === "expired") {
      expired.push(subscription.subscription_id);
    } else {
      failed += 1;
    }
  }

  // Housekeeping failing must not turn a delivered Reminder into an error, or hide that it went.
  try {
    if (expired.length > 0) await deps.deleteSubscriptions(expired);
    for (const [userId, localDay] of reached)
      await deps.markSent(userId, localDay);
  } catch (error) {
    console.error("could not record sent Reminders", error);
  }

  return reply(200, {
    users: users.size,
    sent,
    expired: expired.length,
    failed,
  });
}
