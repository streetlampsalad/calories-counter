import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APPEARANCE_STORAGE_KEY,
  hasSavedAppearance,
  parseAppearance,
  themeColor,
} from "./appearance";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("parseAppearance", () => {
  it("keeps a known choice", () => {
    expect(parseAppearance("dark")).toBe("dark");
    expect(parseAppearance("system")).toBe("system");
    expect(parseAppearance("light")).toBe("light");
  });

  it("treats a missing or unknown choice as Light (US1.3)", () => {
    expect(parseAppearance(undefined)).toBe("light");
    expect(parseAppearance(null)).toBe("light");
    expect(parseAppearance("sepia")).toBe("light");
  });
});

describe("saved choice", () => {
  it("is found once saved", () => {
    expect(hasSavedAppearance()).toBe(false);
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, "dark");

    expect(hasSavedAppearance()).toBe(true);
  });

  it("never throws when storage is blocked (US1.7)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(hasSavedAppearance()).toBe(false);
  });
});

describe("themeColor", () => {
  it("matches the resolved theme (US2.2)", () => {
    expect(themeColor("dark")).toBe("#0a0a0a");
    expect(themeColor("light")).toBe("#ffffff");
  });

  it("is the Light colour for anything unknown", () => {
    expect(themeColor(undefined)).toBe("#ffffff");
    expect(themeColor("sepia")).toBe("#ffffff");
  });
});
