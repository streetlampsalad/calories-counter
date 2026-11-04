// Calories Counter's service worker. It does two jobs. When the app is opened with no connection,
// it shows the offline page instead of the browser's error. Logging needs a connection, so nothing
// else is kept: it never caches pages, API responses or Supabase requests (spec 012, AC-5), only
// the offline page and the app's own static build files, which never change once built. And it
// shows the daily Reminder when the server pushes one, and opens Today when it is tapped (spec 016).

const OFFLINE_URL = "/offline";
const CACHE = "calories-offline-v1";
const STATIC_PREFIX = "/_next/static/";

// Everything the offline page needs to draw itself: the page, its scripts and styles, and the
// fonts and images those styles name.
async function precacheOfflinePage() {
  const cache = await caches.open(CACHE);
  const response = await fetch(OFFLINE_URL, { credentials: "same-origin" });
  if (!response.ok) throw new Error("offline page unavailable");
  const html = await response.clone().text();
  await cache.put(OFFLINE_URL, response);

  const assets = new Set(html.match(/\/_next\/static\/[^"'()\s\\<>]+/g) ?? []);
  const styles = [];
  await Promise.all(
    [...assets].map(async (asset) => {
      try {
        const res = await fetch(asset);
        if (!res.ok) return;
        if (asset.endsWith(".css"))
          styles.push(
            res
              .clone()
              .text()
              .then((text) => ({ asset, text })),
          );
        await cache.put(asset, res);
      } catch {
        // A missing asset only costs the offline page a little polish.
      }
    }),
  );
  for (const { asset, text } of await Promise.all(styles)) {
    const base = new URL(asset, self.location.origin);
    const referenced = new Set(
      [...text.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)]
        .map((match) => new URL(match[1], base))
        .filter(
          (url) =>
            url.origin === self.location.origin &&
            url.pathname.startsWith(STATIC_PREFIX),
        )
        .map((url) => url.pathname),
    );
    await Promise.all(
      [...referenced].map(async (path) => {
        try {
          const res = await fetch(path);
          if (res.ok) await cache.put(path, res);
        } catch {
          // As above.
        }
      }),
    );
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions of this worker, then take over open pages straight away.
      for (const name of await caches.keys()) {
        if (name !== CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase and every other origin: never touched

  // Opening a page: the network as usual, and the offline page if there is none.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return offline ?? Response.error();
      }),
    );
    return;
  }

  // The app's own build files are named by their content, so a kept copy is always right.
  if (url.pathname.startsWith(STATIC_PREFIX)) {
    event.respondWith(
      (async () => {
        const kept = await caches.match(request);
        if (kept) return kept;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      })(),
    );
  }
  // Everything else (API calls, data, images) goes straight to the network.
});

// The Reminder (spec 016). Chrome requires every push to show a notification, so a message we
// cannot read still shows the default text rather than being dropped.
const DEFAULT_REMINDER = {
  title: "Nothing logged today",
  body: "Tap to log what you've eaten.",
  url: "/",
};

function reminderFrom(event) {
  try {
    const data = event.data ? event.data.json() : {};
    return {
      title:
        typeof data.title === "string" ? data.title : DEFAULT_REMINDER.title,
      body: typeof data.body === "string" ? data.body : DEFAULT_REMINDER.body,
      url: typeof data.url === "string" ? data.url : DEFAULT_REMINDER.url,
    };
  } catch {
    return DEFAULT_REMINDER;
  }
}

self.addEventListener("push", (event) => {
  const { title, body, url } = reminderFrom(event);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      // One Reminder at a time: a newer one replaces an old one nobody tapped.
      tag: "daily-reminder",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only ever somewhere in this app, whatever the message said.
  const requested = new URL(
    event.notification.data?.url || "/",
    self.location.origin,
  );
  const target =
    requested.origin === self.location.origin
      ? requested.href
      : `${self.location.origin}/`;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const open = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (open) {
        await open.focus();
        if ("navigate" in open) await open.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
