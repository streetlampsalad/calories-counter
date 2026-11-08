import { connection } from "next/server";
import { handleFeatureRequestSync } from "@/features/feature-requests/sync-handler";
import { createPushSender } from "@/features/reminders/web-push-sender";
import { createAdminClient } from "@/lib/supabase/admin";

// A Ready to try notice is still worth seeing days later, unlike a Reminder.
const NOTIFICATION_TTL_SECONDS = 3 * 24 * 60 * 60;

// Called by the board workflow after every Issue and pull request event (spec 124). Refuses anyone
// without the shared secret before it touches the database or the VAPID keys.
export async function POST(request: Request) {
  await connection();

  let sender: ReturnType<typeof createPushSender> | undefined;

  return handleFeatureRequestSync(request, {
    secret: process.env.FEATURE_REQUESTS_SYNC_SECRET,
    apply: async (updates) => {
      const { data, error } = await createAdminClient().rpc(
        "apply_feature_request_sync",
        { updates },
      );
      if (error) throw error;
      return data;
    },
    devices: async (userIds) => {
      const { data, error } = await createAdminClient()
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth")
        .in("user_id", userIds);
      if (error) throw error;
      return data.map((row) => ({
        subscription_id: row.id,
        user_id: row.user_id,
        endpoint: row.endpoint,
        p256dh_key: row.p256dh,
        auth_secret: row.auth,
      }));
    },
    send: async (target, payload) => {
      const { VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!VAPID_PRIVATE_KEY || !VAPID_SUBJECT || !publicKey) {
        throw new Error("the VAPID keys are not set");
      }
      sender ??= createPushSender(
        { subject: VAPID_SUBJECT, publicKey, privateKey: VAPID_PRIVATE_KEY },
        NOTIFICATION_TTL_SECONDS,
      );
      return sender(target, payload);
    },
    deleteSubscriptions: async (ids) => {
      const { error } = await createAdminClient()
        .from("push_subscriptions")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    dueReminders: async () => {
      const { data, error } = await createAdminClient().rpc(
        "due_testing_reminders",
      );
      if (error) throw error;
      return data;
    },
  });
}
