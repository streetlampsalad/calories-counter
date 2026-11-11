// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { type DeviceNavigator, describeDevice, parseDevice } from "./device";

const win = (overrides: Record<string, unknown> = {}) => ({
  screen: { width: 412, height: 915 },
  devicePixelRatio: 2.625,
  matchMedia: () => ({ matches: false }),
  ...overrides,
});

const PIXEL_HINTS = {
  brands: [
    { brand: "Not.A/Brand", version: "99" },
    { brand: "Chromium", version: "142" },
    { brand: "Google Chrome", version: "142" },
  ],
  platform: "Android",
  getHighEntropyValues: async () => ({
    model: "Pixel 7",
    platformVersion: "16.0.0",
  }),
};

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const FIREFOX_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0";

describe("describeDevice", () => {
  it("reads the model, system and browser from Client Hints, major versions only (US2.1)", async () => {
    const device = await describeDevice(
      { userAgent: "ignored", userAgentData: PIXEL_HINTS },
      win(),
    );
    expect(device).toMatchObject({
      model: "Pixel 7",
      os: "Android 16",
      browser: "Chrome 142",
    });
  });

  it("names Edge by its brand", async () => {
    const device = await describeDevice(
      {
        userAgent: "",
        userAgentData: {
          ...PIXEL_HINTS,
          brands: [
            { brand: "Chromium", version: "142" },
            { brand: "Microsoft Edge", version: "142" },
          ],
        },
      },
      win(),
    );
    expect(device.browser).toBe("Edge 142");
  });

  it("reads Unknown for an empty model", async () => {
    const device = await describeDevice(
      {
        userAgent: "",
        userAgentData: {
          ...PIXEL_HINTS,
          getHighEntropyValues: async () => ({
            model: "",
            platformVersion: "16.0.0",
          }),
        },
      },
      win(),
    );
    expect(device.model).toBe("Unknown");
  });

  it("falls back to the user-agent string when Client Hints fail (US2.2)", async () => {
    const device = await describeDevice(
      {
        userAgent: IPHONE_UA,
        userAgentData: {
          ...PIXEL_HINTS,
          getHighEntropyValues: async () => {
            throw new Error("denied");
          },
        },
      },
      win(),
    );
    expect(device).toMatchObject({
      model: "iPhone",
      os: "iOS 17",
      browser: "Safari 17",
    });
  });

  it("reads an iPhone from its user-agent string (US2.2)", async () => {
    expect(await describeDevice({ userAgent: IPHONE_UA }, win())).toMatchObject(
      { model: "iPhone", os: "iOS 17", browser: "Safari 17" },
    );
  });

  it("reads Firefox on a desktop, with Unknown for what it can't tell (US2.2)", async () => {
    expect(
      await describeDevice({ userAgent: FIREFOX_UA }, win()),
    ).toMatchObject({
      model: "Unknown",
      os: "Windows",
      browser: "Firefox 125",
    });
  });

  it("reads Android and Chrome from a user-agent string", async () => {
    const device = await describeDevice(
      {
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
      },
      win(),
    );
    expect(device).toMatchObject({
      model: "SM-S911B",
      os: "Android 14",
      browser: "Chrome 141",
    });
  });

  it("says Unknown for a user-agent string it can't read, and never repeats it", async () => {
    const device = await describeDevice({ userAgent: "Weird/1.0" }, win());
    expect(device).toMatchObject({
      model: "Unknown",
      os: "Unknown",
      browser: "Unknown",
    });
    expect(JSON.stringify(device)).not.toContain("Weird");
  });

  it("says Installed app when standalone, else Browser tab (US2.3)", async () => {
    const standalone = win({
      matchMedia: (query: string) => ({
        matches: query === "(display-mode: standalone)",
      }),
    });
    expect((await describeDevice({ userAgent: "" }, standalone)).openedAs).toBe(
      "Installed app",
    );
    expect(
      (await describeDevice({ userAgent: "", standalone: true }, win()))
        .openedAs,
    ).toBe("Installed app");
    expect((await describeDevice({ userAgent: "" }, win())).openedAs).toBe(
      "Browser tab",
    );
  });

  it("writes the screen size in CSS pixels with the pixel ratio", async () => {
    const nav: DeviceNavigator = { userAgent: "" };
    expect((await describeDevice(nav, win())).screen).toBe(
      "412 × 915 at 2.63×",
    );
    expect(
      (
        await describeDevice(
          nav,
          win({ screen: { width: 390, height: 844 }, devicePixelRatio: 3 }),
        )
      ).screen,
    ).toBe("390 × 844 at 3×");
    expect(
      (await describeDevice(nav, win({ devicePixelRatio: 1.5 }))).screen,
    ).toBe("412 × 915 at 1.5×");
  });

  it("names the stored Appearance, and the time zone", async () => {
    localStorage.setItem("theme", "dark");
    const device = await describeDevice({ userAgent: "" }, win());
    expect(device.appearance).toBe("Dark");
    expect(device.timeZone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown",
    );
    localStorage.removeItem("theme");
    expect((await describeDevice({ userAgent: "" }, win())).appearance).toBe(
      "Light",
    );
    localStorage.setItem("theme", "system");
    expect((await describeDevice({ userAgent: "" }, win())).appearance).toBe(
      "System",
    );
    localStorage.removeItem("theme");
  });
});

describe("parseDevice", () => {
  it("keeps the seven fields, trimmed (US2.5)", () => {
    const device = {
      model: " Pixel 7 ",
      os: "Android 16",
      browser: "Chrome 142",
      openedAs: "Installed app",
      screen: "412 × 915 at 2.63×",
      appearance: "System",
      timeZone: "Australia/Sydney",
    };
    expect(parseDevice(device)).toEqual({ ...device, model: "Pixel 7" });
  });

  it("drops unknown keys, non-text values, and cuts long values at 100 characters (US2.5)", () => {
    expect(
      parseDevice({
        model: "x".repeat(150),
        os: 16,
        browser: { name: "Chrome" },
        extra: "nope",
        timeZone: "Australia/Sydney",
      }),
    ).toEqual({ model: "x".repeat(100), timeZone: "Australia/Sydney" });
  });

  it("returns nothing for anything that isn't an object (US2.6)", () => {
    for (const value of [undefined, null, "text", 5, ["model"]])
      expect(parseDevice(value)).toEqual({});
  });
});
