// A short buzz for the actions that deserve one (spec 015). It uses the Vibration API, which
// Chrome on Android has and Safari does not, so everything here quietly does nothing where the
// phone cannot vibrate. The User can switch it off; that choice lives on this device only.

export type HapticKind = "tap" | "confirm" | "error";

export const HAPTIC_PATTERNS: Record<HapticKind, VibratePattern> = {
  /** Something small worked: an Entry added, selection started. */
  tap: 10,
  /** Something bigger was decided: a bulk delete. */
  confirm: 30,
  /** A save failed and was rolled back: two pulses, so it feels different. */
  error: [30, 60, 30],
};

const STORAGE_KEY = "vibration";
const CHANGED = "vibration-setting-changed";

export const canVibrate = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

// On unless the User turned it off. Storage can be blocked or throw (private windows, cleared
// site data), and then vibration is simply on.
export function isVibrationOn(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setVibrationOn(on: boolean) {
  try {
    if (on) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, "off");
  } catch {
    // Not saved, but the switch still takes effect for this visit.
  }
  window.dispatchEvent(new Event(CHANGED));
}

// For useSyncExternalStore: changes made here, and in another tab of the app.
export function subscribeVibration(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function haptic(kind: HapticKind) {
  if (!canVibrate() || !isVibrationOn()) return;
  navigator.vibrate(HAPTIC_PATTERNS[kind]);
}
