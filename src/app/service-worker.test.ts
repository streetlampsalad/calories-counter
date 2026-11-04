import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

// public/sw.js is plain JavaScript the browser loads directly, so run it here against a stand-in
// for the worker's global scope and fire its events by hand.
const source = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
const ORIGIN = "https://calories.example.test";

type Listener = (event: unknown) => void;
type Client = {
  url: string;
  focus: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
};

function loadWorker(clients: Client[] = []) {
  const listeners = new Map<string, Listener>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const self = {
    location: { origin: ORIGIN },
    registration: { showNotification },
    clients: {
      matchAll: vi.fn().mockResolvedValue(clients),
      openWindow,
      claim: vi.fn(),
    },
    addEventListener: (type: string, listener: Listener) =>
      listeners.set(type, listener),
    skipWaiting: vi.fn(),
  };
  runInNewContext(source, { self, URL, console, caches: {}, fetch: vi.fn() });

  // Fires an event and waits for whatever it handed to waitUntil.
  async function fire(type: string, event: Record<string, unknown>) {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)?.({
      ...event,
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    });
    await Promise.all(pending);
  }
  return {
    fire,
    showNotification,
    openWindow,
    matchAll: self.clients.matchAll,
  };
}

const pushOf = (body: unknown) => ({
  data: { json: () => body },
});

describe("the Reminder push handler (AC-4)", () => {
  it("shows the title and body the server sent", async () => {
    const worker = loadWorker();

    await worker.fire(
      "push",
      pushOf({ title: "Nothing logged today", body: "Tap to log.", url: "/" }),
    );

    expect(worker.showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = worker.showNotification.mock.calls[0];
    expect(title).toBe("Nothing logged today");
    expect(options).toMatchObject({
      body: "Tap to log.",
      icon: "/icons/icon-192.png",
      data: { url: "/" },
    });
  });

  it("replaces an earlier Reminder nobody tapped, rather than stacking them", async () => {
    const worker = loadWorker();

    await worker.fire("push", pushOf({ title: "A", body: "B", url: "/" }));

    expect(worker.showNotification.mock.calls[0][1].tag).toBe("daily-reminder");
  });

  it("still shows the default Reminder when the message is empty or unreadable", async () => {
    const empty = loadWorker();
    await empty.fire("push", { data: null });
    const broken = loadWorker();
    await broken.fire("push", {
      data: {
        json: () => {
          throw new SyntaxError("not json");
        },
      },
    });

    for (const worker of [empty, broken]) {
      const [title, options] = worker.showNotification.mock.calls[0];
      expect(title).toBe("Nothing logged today");
      expect(options.body).toBe("Tap to log what you've eaten.");
    }
  });

  it("ignores fields of the wrong type", async () => {
    const worker = loadWorker();

    await worker.fire("push", pushOf({ title: 7, body: {}, url: null }));

    const [title, options] = worker.showNotification.mock.calls[0];
    expect(title).toBe("Nothing logged today");
    expect(options.data.url).toBe("/");
  });
});

describe("tapping the Reminder (AC-7)", () => {
  let close: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    close = vi.fn();
  });
  const tapped = (url?: string) => ({
    notification: { close, data: url === undefined ? undefined : { url } },
  });

  it("opens Today when the app is not open", async () => {
    const worker = loadWorker([]);

    await worker.fire("notificationclick", tapped("/"));

    expect(close).toHaveBeenCalled();
    expect(worker.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });

  it("brings an open app to the front and shows Today in it", async () => {
    const client: Client = {
      url: `${ORIGIN}/summary`,
      focus: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn().mockResolvedValue(undefined),
    };
    const worker = loadWorker([client]);

    await worker.fire("notificationclick", tapped("/"));

    expect(client.focus).toHaveBeenCalled();
    expect(client.navigate).toHaveBeenCalledWith(`${ORIGIN}/`);
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it("never opens another site, whatever the message asked for", async () => {
    const worker = loadWorker([]);

    await worker.fire(
      "notificationclick",
      tapped("https://evil.example.test/x"),
    );

    expect(worker.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });

  it("opens Today when the notification carries no address", async () => {
    const worker = loadWorker([]);

    await worker.fire("notificationclick", tapped());

    expect(worker.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });
});
