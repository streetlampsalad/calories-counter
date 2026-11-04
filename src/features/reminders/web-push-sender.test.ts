import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPushSender } from "./web-push-sender";

const { sendNotification, setVapidDetails } = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));
vi.mock("web-push", () => ({
  default: { sendNotification, setVapidDetails },
}));

const subscription = {
  user_id: "ada",
  local_day: "2026-09-15",
  subscription_id: "s1",
  endpoint: "https://push.example.test/s1",
  p256dh_key: "public-key",
  auth_secret: "auth-secret",
};
const vapid = {
  subject: "mailto:owner@example.test",
  publicKey: "public",
  privateKey: "private",
};

describe("createPushSender", () => {
  beforeEach(() => {
    sendNotification.mockReset();
    setVapidDetails.mockReset();
  });

  it("signs with the VAPID keys and sends the payload to the device's endpoint and keys", async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 });

    const result = await createPushSender(vapid)(subscription, '{"title":"x"}');

    expect(result).toBe("sent");
    expect(setVapidDetails).toHaveBeenCalledWith(
      "mailto:owner@example.test",
      "public",
      "private",
    );
    expect(sendNotification).toHaveBeenCalledWith(
      {
        endpoint: "https://push.example.test/s1",
        keys: { p256dh: "public-key", auth: "auth-secret" },
      },
      '{"title":"x"}',
      expect.objectContaining({ TTL: expect.any(Number) }),
    );
  });

  it.each([
    404, 410,
  ])("calls a device the push service answers %i for expired", async (statusCode) => {
    sendNotification.mockRejectedValue(
      Object.assign(new Error("gone"), { statusCode }),
    );

    expect(await createPushSender(vapid)(subscription, "{}")).toBe("expired");
  });

  it.each([
    400, 413, 429, 500, 503,
  ])("keeps a device when the push service answers %i", async (statusCode) => {
    sendNotification.mockRejectedValue(
      Object.assign(new Error("trouble"), { statusCode }),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await createPushSender(vapid)(subscription, "{}")).toBe("failed");
  });

  it("calls a failure with no status failed rather than expired", async () => {
    sendNotification.mockRejectedValue(new Error("ECONNRESET"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await createPushSender(vapid)(subscription, "{}")).toBe("failed");
  });
});
