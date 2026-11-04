import { createClient } from "@/lib/supabase/client";

export const reminderKeys = {
  all: ["reminders"] as const,
  device: () => [...reminderKeys.all, "device"] as const,
};

// The public half of the push key pair, built into the app. Without it this deployment cannot send
// Reminders yet (scripts/setup-reminders.sh sets it), so the Settings section stays hidden.
// Next.js only inlines NEXT_PUBLIC_* values that are referenced literally.
export const vapidPublicKey = (): string | null =>
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;

// Whether this browser can receive a push at all. Android Chrome can; some embedded browsers and
// desktops can't, and the server can't know which, so this is only ever asked on the client.
export function canReceivePush(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export const deviceTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

// The push service wants the public key as bytes; we keep it as URL-safe base64 text.
export function urlBase64ToUint8Array(text: string): Uint8Array<ArrayBuffer> {
  const padded = text
    .padEnd(text.length + ((4 - (text.length % 4)) % 4), "=")
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameBytes(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.length) return false;
  const view = new Uint8Array(a);
  return view.every((byte, index) => byte === b[index]);
}

// The service worker is only registered in production builds, so waiting for it in development
// would never end. Give up after a few seconds instead.
async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("The service worker is not ready")),
      8000,
    ),
  );
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

// The push subscription this phone already has, if any. Never waits for a worker to start.
async function existingSubscription(): Promise<PushSubscription | null> {
  if (!canReceivePush()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

// The address of this phone's push subscription, or null when it has none.
export async function currentEndpoint(): Promise<string | null> {
  return (await existingSubscription())?.endpoint ?? null;
}

// Subscribes this phone to push (the permission must already be granted) and tells the server, so
// the scheduler can reach it. Safe to run again: it reuses a subscription that already works.
export async function subscribeThisDevice(publicKey: string): Promise<void> {
  const registration = await readyRegistration();
  const key = urlBase64ToUint8Array(publicKey);

  let subscription = await registration.pushManager.getSubscription();
  // A subscription made with an older key can never be sent to with the current one.
  if (
    subscription &&
    !sameBytes(subscription.options.applicationServerKey, key)
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });

  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error("The push subscription is incomplete");
  }
  const { error } = await createClient()
    .from("push_subscriptions")
    .upsert(
      { endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: "endpoint" },
    );
  if (error) throw error;
}

// Forgets this phone: removes it from the server first (that needs the User's session, so sign out
// only after this), then from the browser. Does nothing when the phone has no subscription.
export async function unsubscribeThisDevice(): Promise<void> {
  const subscription = await existingSubscription();
  if (!subscription) return;
  const { error } = await createClient()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", subscription.endpoint);
  if (error) throw error;
  await subscription.unsubscribe();
}
