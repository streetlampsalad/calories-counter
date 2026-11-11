import {
  APPEARANCE_STORAGE_KEY,
  type Appearance,
  parseAppearance,
} from "@/lib/appearance";

// What the app attaches to a Bug report about the device (spec 194 Slice 2). Nothing here is
// identifying: no user-agent string, only the model, system and browser (major versions), how the
// app was opened, the screen, Appearance and time zone.

export type Device = {
  model: string;
  os: string;
  browser: string;
  openedAs: string;
  screen: string;
  appearance: string;
  timeZone: string;
};

// The lines of `Attached to your report` and of the Issue's `### Device`, in order, so the Issue
// reads as the preview does (FR-007, FR-008). App version comes first and is not in Device.
export const APP_VERSION_LABEL = "App version";
export const DEVICE_LINES: readonly { key: keyof Device; label: string }[] = [
  { key: "model", label: "Model" },
  { key: "os", label: "Operating system" },
  { key: "browser", label: "Browser" },
  { key: "openedAs", label: "Opened as" },
  { key: "screen", label: "Screen" },
  { key: "appearance", label: "Appearance" },
  { key: "timeZone", label: "Time zone" },
];

const UNKNOWN = "Unknown";
const MAX_LENGTH = 100;

type Hints = {
  brands?: readonly { brand: string; version: string }[];
  platform?: string;
  getHighEntropyValues?: (
    hints: string[],
  ) => Promise<{ model?: string; platformVersion?: string }>;
};

// The parts of `navigator` and `window` that are read, so tests can pass plain objects.
export type DeviceNavigator = {
  userAgent: string;
  userAgentData?: Hints;
  standalone?: boolean;
};
export type DeviceWindow = {
  screen: { width: number; height: number };
  devicePixelRatio: number;
  matchMedia: (query: string) => { matches: boolean };
};

const major = (version: string | undefined) =>
  version?.match(/^\d+/)?.[0] ?? "";
const withVersion = (name: string, version: string | undefined) => {
  const m = major(version);
  return m ? `${name} ${m}` : name;
};

const BROWSER_BRANDS: [RegExp, string][] = [
  [/^Microsoft Edge$/, "Edge"],
  [/^Google Chrome$/, "Chrome"],
  [/^Opera$/, "Opera"],
  [/^Brave$/, "Brave"],
];

function browserFromBrands(brands: Hints["brands"]): string {
  for (const [pattern, name] of BROWSER_BRANDS) {
    const found = brands?.find((b) => pattern.test(b.brand));
    if (found) return withVersion(name, found.version);
  }
  // GREASE brands ("Not_A Brand", "Not)A;Brand"…) are noise Chromium adds on purpose.
  const plain = brands?.find(
    (b) =>
      b.brand !== "Chromium" &&
      !/not.?a.?brand/i.test(b.brand) &&
      /^[\w ]+$/.test(b.brand.trim()),
  );
  if (plain) return withVersion(plain.brand.trim(), plain.version);
  const chromium = brands?.find((b) => b.brand === "Chromium");
  return chromium ? withVersion("Chromium", chromium.version) : UNKNOWN;
}

async function fromHints(
  hints: Hints,
): Promise<Pick<Device, "model" | "os" | "browser"> | null> {
  if (!hints.getHighEntropyValues) return null;
  try {
    const high = await hints.getHighEntropyValues(["model", "platformVersion"]);
    const platform = hints.platform?.trim();
    return {
      model: high.model?.trim() || UNKNOWN,
      os: platform ? withVersion(platform, high.platformVersion) : UNKNOWN,
      browser: browserFromBrands(hints.brands),
    };
  } catch {
    return null;
  }
}

function fromUserAgent(ua: string): Pick<Device, "model" | "os" | "browser"> {
  let model = UNKNOWN;
  let os = UNKNOWN;
  const ios = ua.match(/\b(iPhone|iPad)\b.*?OS (\d+)/);
  const android = ua.match(/Android (\d+)(?:[^;)]*)?(?:; ([^;)]+))?/);
  if (ios) {
    model = ios[1];
    os = `iOS ${ios[2]}`;
  } else if (android) {
    os = `Android ${android[1]}`;
    const name = android[2]?.replace(/\s*Build\/.*$/, "").trim();
    // Firefox puts Mobile or Tablet where Chrome puts the model; the reduced user-agent says K.
    if (name && name.length > 1 && !/^(Mobile|Tablet)$|rv:/.test(name))
      model = name;
  } else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Linux|X11/.test(ua)) os = "Linux";

  const browser =
    ua.match(/\bEdgA?\/(\d+)/)?.[1] !== undefined
      ? withVersion("Edge", ua.match(/\bEdgA?\/(\d+)/)?.[1])
      : /\bFirefox\/(\d+)/.test(ua) || /\bFxiOS\/(\d+)/.test(ua)
        ? withVersion(
            "Firefox",
            (ua.match(/\bFirefox\/(\d+)/) ?? ua.match(/\bFxiOS\/(\d+)/))?.[1],
          )
        : /\b(?:CriOS|Chrome)\/(\d+)/.test(ua)
          ? withVersion("Chrome", ua.match(/\b(?:CriOS|Chrome)\/(\d+)/)?.[1])
          : /\bVersion\/(\d+).*\bSafari\//.test(ua)
            ? withVersion("Safari", ua.match(/\bVersion\/(\d+)/)?.[1])
            : UNKNOWN;
  return { model, os, browser };
}

function describeAppearance(): string {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  } catch {}
  const appearance: Appearance = parseAppearance(stored);
  return appearance.charAt(0).toUpperCase() + appearance.slice(1);
}

function describeScreen(win: DeviceWindow): string {
  const ratio = Number.parseFloat((win.devicePixelRatio || 1).toFixed(2));
  return `${win.screen.width} × ${win.screen.height} at ${ratio}×`;
}

// Runs in the browser, after the page has loaded.
export async function describeDevice(
  nav: DeviceNavigator,
  win: DeviceWindow,
): Promise<Device> {
  const system =
    (nav.userAgentData ? await fromHints(nav.userAgentData) : null) ??
    fromUserAgent(nav.userAgent ?? "");
  const installed =
    nav.standalone === true ||
    win.matchMedia("(display-mode: standalone)").matches;

  return {
    ...system,
    openedAs: installed ? "Installed app" : "Browser tab",
    screen: describeScreen(win),
    appearance: describeAppearance(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || UNKNOWN,
  };
}

// On the server: whatever arrives is untrusted. Keeps only the seven fields, as text of at most
// 100 characters; everything else is dropped (spec 194 FR-008).
export function parseDevice(value: unknown): Partial<Device> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return {};
  const record = value as Record<string, unknown>;
  const device: Partial<Device> = {};
  for (const { key } of DEVICE_LINES) {
    const text = record[key];
    if (typeof text !== "string") continue;
    // By code point, so an emoji is never split in half.
    const cut = Array.from(text.trim()).slice(0, MAX_LENGTH).join("").trim();
    if (cut) device[key] = cut;
  }
  return device;
}
