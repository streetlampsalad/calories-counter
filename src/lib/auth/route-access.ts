// The manifest, service worker and offline page are fetched by the browser itself, without the
// User's session, so they must be reachable by anyone for the app to install and work offline.
const PUBLIC_PATHS = [
  "/sign-in",
  "/auth/callback",
  "/api/health",
  // Called by the database's scheduler, which has no session. It proves itself with a shared
  // secret instead (spec 016, ADR 0005).
  "/api/reminders/send",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline",
];

export type Access =
  | { action: "next" }
  | { action: "redirect"; to: string }
  // An API call has no page to send the caller to, so it is simply refused.
  | { action: "unauthorized" };

export function decideAccess(input: {
  pathname: string;
  search: string;
  signedIn: boolean;
}): Access {
  const { pathname, search, signedIn } = input;

  if (signedIn) {
    return pathname === "/sign-in"
      ? { action: "redirect", to: "/" }
      : { action: "next" };
  }
  if (PUBLIC_PATHS.includes(pathname)) return { action: "next" };
  if (pathname.startsWith("/api/")) return { action: "unauthorized" };

  return {
    action: "redirect",
    to: `/sign-in?next=${encodeURIComponent(pathname + search)}`,
  };
}
