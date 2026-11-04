import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type DueSubscription,
  handleSendReminders,
  REMINDER_PAYLOAD,
  type SendResult,
} from "./send-handler";

const SECRET = "scheduler-secret";
const NOW = new Date("2026-09-15T09:00:00Z");

const sub = (
  id: string,
  userId: string,
  localDay = "2026-09-15",
): DueSubscription => ({
  user_id: userId,
  local_day: localDay,
  subscription_id: id,
  endpoint: `https://push.example.test/${id}`,
  p256dh_key: `key-${id}`,
  auth_secret: `auth-${id}`,
});

const dueReminders = vi.fn<(at: Date) => Promise<DueSubscription[]>>();
const send =
  vi.fn<
    (subscription: DueSubscription, payload: string) => Promise<SendResult>
  >();
const deleteSubscriptions = vi.fn<(ids: string[]) => Promise<void>>();
const markSent = vi.fn<(userId: string, localDay: string) => Promise<void>>();

const post = (headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/reminders/send", {
    method: "POST",
    headers,
  });
const call = (request: Request, secret: string | undefined = SECRET) =>
  handleSendReminders(request, {
    secret,
    now: () => NOW,
    dueReminders,
    send,
    deleteSubscriptions,
    markSent,
  });
const authorised = () => post({ "x-scheduler-secret": SECRET });

describe("handleSendReminders", () => {
  beforeEach(() => {
    dueReminders.mockReset();
    dueReminders.mockResolvedValue([]);
    send.mockReset();
    send.mockResolvedValue("sent");
    deleteSubscriptions.mockReset();
    markSent.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it.each([
    ["no secret at all", {}],
    ["the wrong secret", { "x-scheduler-secret": "guess" }],
    ["a secret of the wrong length", { "x-scheduler-secret": `${SECRET}x` }],
    ["an empty secret", { "x-scheduler-secret": "" }],
    ["a bearer token instead", { authorization: `Bearer ${SECRET}` }],
  ])("refuses a call with %s, and looks at nothing (AC-11)", async (_, headers) => {
    const response = await call(post(headers));

    expect(response.status).toBe(401);
    expect(dueReminders).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses everything when the server has no secret configured", async () => {
    expect(
      (await call(post({ "x-scheduler-secret": "" }), undefined)).status,
    ).toBe(401);
    expect((await call(authorised(), "")).status).toBe(401);
    expect(dueReminders).not.toHaveBeenCalled();
  });

  it("asks who is due at this moment, and does nothing when nobody is", async () => {
    const response = await call(authorised());

    expect(dueReminders).toHaveBeenCalledWith(NOW);
    expect(send).not.toHaveBeenCalled();
    expect(markSent).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      users: 0,
      sent: 0,
      expired: 0,
      failed: 0,
    });
  });

  it("sends the Reminder to every device of every due User (AC-4)", async () => {
    dueReminders.mockResolvedValue([
      sub("a1", "ada"),
      sub("a2", "ada"),
      sub("b1", "bo"),
    ]);

    const response = await call(authorised());

    expect(send).toHaveBeenCalledTimes(3);
    for (const [, payload] of send.mock.calls) {
      expect(JSON.parse(payload)).toEqual(REMINDER_PAYLOAD);
    }
    expect(REMINDER_PAYLOAD).toEqual({
      title: "Nothing logged today",
      body: "Tap to log what you've eaten.",
      url: "/",
    });
    expect(await response.json()).toEqual({
      users: 2,
      sent: 3,
      expired: 0,
      failed: 0,
    });
  });

  it("marks each User's own local Day as sent, once (AC-6)", async () => {
    dueReminders.mockResolvedValue([
      sub("a1", "ada", "2026-09-15"),
      sub("a2", "ada", "2026-09-15"),
      sub("b1", "bo", "2026-09-14"),
    ]);

    await call(authorised());

    expect(markSent).toHaveBeenCalledTimes(2);
    expect(markSent).toHaveBeenCalledWith("ada", "2026-09-15");
    expect(markSent).toHaveBeenCalledWith("bo", "2026-09-14");
  });

  it("deletes a subscription the push service says has expired, and still marks the User if another device got it (AC-8)", async () => {
    dueReminders.mockResolvedValue([sub("old", "ada"), sub("new", "ada")]);
    send.mockImplementation(async (s) =>
      s.subscription_id === "old" ? "expired" : "sent",
    );

    const response = await call(authorised());

    expect(deleteSubscriptions).toHaveBeenCalledWith(["old"]);
    expect(markSent).toHaveBeenCalledWith("ada", "2026-09-15");
    expect(await response.json()).toEqual({
      users: 1,
      sent: 1,
      expired: 1,
      failed: 0,
    });
  });

  it("does not mark a User as sent when no device received it", async () => {
    dueReminders.mockResolvedValue([sub("old", "ada"), sub("flaky", "ada")]);
    send.mockImplementation(async (s) =>
      s.subscription_id === "old" ? "expired" : "failed",
    );

    const response = await call(authorised());

    expect(markSent).not.toHaveBeenCalled();
    expect(deleteSubscriptions).toHaveBeenCalledWith(["old"]);
    expect(await response.json()).toEqual({
      users: 1,
      sent: 0,
      expired: 1,
      failed: 1,
    });
  });

  it("keeps a subscription whose send failed for another reason", async () => {
    dueReminders.mockResolvedValue([sub("a1", "ada")]);
    send.mockResolvedValue("failed");

    await call(authorised());

    expect(deleteSubscriptions).not.toHaveBeenCalled();
  });

  it("carries on when one send throws, so one bad device never blocks the rest", async () => {
    dueReminders.mockResolvedValue([sub("a1", "ada"), sub("b1", "bo")]);
    send.mockImplementation(async (s) => {
      if (s.subscription_id === "a1") throw new Error("network down");
      return "sent";
    });

    const response = await call(authorised());

    expect(response.status).toBe(200);
    expect(markSent).toHaveBeenCalledWith("bo", "2026-09-15");
    expect(markSent).not.toHaveBeenCalledWith("ada", expect.anything());
    expect(await response.json()).toEqual({
      users: 2,
      sent: 1,
      expired: 0,
      failed: 1,
    });
  });

  it("answers 500 without leaking details when the database cannot be asked", async () => {
    dueReminders.mockRejectedValue(
      new Error("connection refused: postgres://secret"),
    );

    const response = await call(authorised());

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });

  it("is never cached", async () => {
    const response = await call(authorised());

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
