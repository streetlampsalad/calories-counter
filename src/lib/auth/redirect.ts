// Only same-site relative paths may be used as a post-sign-in destination.
export function sanitizeNext(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\"))
    return "/";
  if (next === "/sign-in" || next.startsWith("/sign-in?")) return "/";
  return next;
}
