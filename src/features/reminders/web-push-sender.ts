import webpush from "web-push";
import type { DueSubscription, SendResult } from "./send-handler";

export type VapidKeys = {
  /** A `mailto:` or https URL the push services can reach the owner on. */
  subject: string;
  publicKey: string;
  privateKey: string;
};

// A Reminder for this evening is no use tomorrow, so a phone that is off should not show it late.
const TTL_SECONDS = 2 * 60 * 60;

// Sends one Web Push message. Only a 404 or 410 means the device is gone for good; anything else
// (a busy push service, a dropped connection) leaves the subscription alone for next time.
export function createPushSender(vapid: VapidKeys) {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  return async (
    subscription: DueSubscription,
    payload: string,
  ): Promise<SendResult> => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_secret,
          },
        },
        payload,
        { TTL: TTL_SECONDS },
      );
      return "sent";
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "expired";
      console.error(`push to ${subscription.subscription_id} failed`, error);
      return "failed";
    }
  };
}
