import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const remove = vi.fn();
const eq = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      expect(table).toBe("push_subscriptions");
      return {
        upsert: (row: unknown, options: unknown) => upsert(row, options),
        delete: () => {
          remove();
          return { eq: (column: string, value: string) => eq(column, value) };
        },
      };
    },
  }),
}));

import {
  canReceivePush,
  currentEndpoint,
  subscribeThisDevice,
  unsubscribeThisDevice,
  urlBase64ToUint8Array,
} from "./push";

// The public key is 65 bytes; any URL-safe base64 will do for these tests.
const PUBLIC_KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
const keyBytes = urlBase64ToUint8Array(PUBLIC_KEY);

function fakeSubscription(
  options: { key?: Uint8Array; endpoint?: string } = {},
) {
  return {
    endpoint: options.endpoint ?? "https://push.example.test/abc",
    options: { applicationServerKey: (options.key ?? keyBytes).buffer },
    toJSON: () => ({
      endpoint: options.endpoint ?? "https://push.example.test/abc",
      keys: { p256dh: "p256dh-value", auth: "auth-value" },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

function stubBrowser(existing: ReturnType<typeof fakeSubscription> | null) {
  const created = fakeSubscription();
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(existing),
    subscribe: vi.fn().mockResolvedValue(created),
  };
  const registration = { pushManager };
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", class {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve(registration),
      getRegistration: vi.fn().mockResolvedValue(registration),
    },
  });
  return { pushManager, created };
}

describe("urlBase64ToUint8Array", () => {
  it("decodes URL-safe base64 with or without padding", () => {
    expect([...urlBase64ToUint8Array("SGk")]).toEqual([72, 105]);
    expect([...urlBase64ToUint8Array("SGk=")]).toEqual([72, 105]);
    expect([...urlBase64ToUint8Array("_-8")]).toEqual([255, 239]);
  });

  it("decodes a real push key to its 65 bytes", () => {
    expect(keyBytes).toHaveLength(65);
    expect(keyBytes[0]).toBe(0x04);
  });
});

describe("push in the browser", () => {
  beforeEach(() => {
    upsert.mockReset();
    upsert.mockResolvedValue({ error: null });
    remove.mockReset();
    eq.mockReset();
    eq.mockResolvedValue({ error: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("is unsupported where there is no push", () => {
    expect(canReceivePush()).toBe(false);
  });

  it("is supported where the worker, push and notifications all exist", () => {
    stubBrowser(null);
    expect(canReceivePush()).toBe(true);
  });

  it("subscribes a phone and saves its endpoint and keys for the server (AC-2)", async () => {
    const { pushManager, created } = stubBrowser(null);

    await subscribeThisDevice(PUBLIC_KEY);

    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: keyBytes,
    });
    expect(created.toJSON().endpoint).toBe("https://push.example.test/abc");
    expect(upsert).toHaveBeenCalledWith(
      {
        endpoint: "https://push.example.test/abc",
        p256dh: "p256dh-value",
        auth: "auth-value",
      },
      { onConflict: "endpoint" },
    );
  });

  it("reuses a subscription the phone already has for the same key", async () => {
    const existing = fakeSubscription({
      endpoint: "https://push.example.test/old",
    });
    const { pushManager } = stubBrowser(existing);

    await subscribeThisDevice(PUBLIC_KEY);

    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://push.example.test/old" }),
      { onConflict: "endpoint" },
    );
  });

  it("replaces a subscription made with an older push key", async () => {
    const stale = fakeSubscription({ key: new Uint8Array([1, 2, 3]) });
    const { pushManager } = stubBrowser(stale);

    await subscribeThisDevice(PUBLIC_KEY);

    expect(stale.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
  });

  it("reports a failure to save rather than pretending the phone is set up", async () => {
    stubBrowser(null);
    upsert.mockResolvedValue({ error: { message: "down" } });

    await expect(subscribeThisDevice(PUBLIC_KEY)).rejects.toMatchObject({
      message: "down",
    });
  });

  it("knows this phone's endpoint, or that it has none", async () => {
    stubBrowser(fakeSubscription({ endpoint: "https://push.example.test/x" }));
    expect(await currentEndpoint()).toBe("https://push.example.test/x");

    stubBrowser(null);
    expect(await currentEndpoint()).toBeNull();
  });

  it("forgets this phone on the server first, then in the browser (AC-8)", async () => {
    const existing = fakeSubscription({
      endpoint: "https://push.example.test/x",
    });
    stubBrowser(existing);

    await unsubscribeThisDevice();

    expect(eq).toHaveBeenCalledWith("endpoint", "https://push.example.test/x");
    expect(existing.unsubscribe).toHaveBeenCalled();
    expect(eq.mock.invocationCallOrder[0]).toBeLessThan(
      existing.unsubscribe.mock.invocationCallOrder[0],
    );
  });

  it("keeps the browser subscription if the server could not forget it", async () => {
    const existing = fakeSubscription();
    stubBrowser(existing);
    eq.mockResolvedValue({ error: { message: "down" } });

    await expect(unsubscribeThisDevice()).rejects.toMatchObject({
      message: "down",
    });
    expect(existing.unsubscribe).not.toHaveBeenCalled();
  });

  it("does nothing for a phone with no subscription", async () => {
    stubBrowser(null);

    await unsubscribeThisDevice();

    expect(remove).not.toHaveBeenCalled();
  });
});
