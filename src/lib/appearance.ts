// Light, Dark or System (spec 147). The choice is kept in this browser, not with the User, and
// until one is made the app is Light. Reading or writing storage must never throw.

export const APPEARANCES = ["light", "dark", "system"] as const;
export type Appearance = (typeof APPEARANCES)[number];

// next-themes' own key, so its pre-paint script and this file read the same value.
export const APPEARANCE_STORAGE_KEY = "theme";

export function parseAppearance(value: string | null | undefined): Appearance {
  return APPEARANCES.find((appearance) => appearance === value) ?? "light";
}

export function hasSavedAppearance(): boolean {
  try {
    return window.localStorage.getItem(APPEARANCE_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSavedAppearance() {
  try {
    window.localStorage.removeItem(APPEARANCE_STORAGE_KEY);
  } catch {
    // Nothing saved, so nothing to clear.
  }
}
