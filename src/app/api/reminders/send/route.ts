import { connection } from "next/server";
import {
  type DueSubscription,
  handleSendReminders,
} from "@/features/reminders/send-handler";
import { createPushSender } from "@/features/reminders/web-push-sender";
import { createAdminClient } from "@/lib/supabase/admin";

// Called every 15 minutes by the database's scheduler (ADR 0005). Refuses anyone without the shared
// secret before it touches the database or the VAPID keys.
export async function POST(request: Request) {
  await connection();

  let sender: ReturnType<typeof createPushSender> | undefined;

  return handleSendReminders(request, {
    secret: process.env.REMINDER_SECRET,
    now: () => new Date(),
    dueReminders: async (at) => {
      const { data, error } = await createAdminClient().rpc("due_reminders", {
        at: at.toISOString(),
      });
      if (error) throw error;
      return data satisfies DueSubscription[];
    },
    send: async (subscription, payload) => {
      const { VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!VAPID_PRIVATE_KEY || !VAPID_SUBJECT || !publicKey) {
        throw new Error("the VAPID keys are not set");
      }
      sender ??= createPushSender({
        subject: VAPID_SUBJECT,
        publicKey,
        privateKey: VAPID_PRIVATE_KEY,
      });
      return sender(subscription, payload);
    },
    deleteSubscriptions: async (ids) => {
      const { error } = await createAdminClient()
        .from("push_subscriptions")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    markSent: async (userId, localDay) => {
      const { error } = await createAdminClient()
        .from("user_settings")
        .update({ reminder_last_sent_on: localDay })
        .eq("user_id", userId);
      if (error) throw error;
    },
  });
}
