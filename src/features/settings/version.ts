// What to show as the app version: the short commit the deploy passed in, or "development".
export function formatVersion(commit: string | undefined): string {
  const trimmed = commit?.trim();
  return trimmed ? trimmed.slice(0, 7) : "development";
}
