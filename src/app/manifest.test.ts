import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("the web app manifest (AC-2)", () => {
  const m = manifest();

  it("names the app", () => {
    expect(m.name).toBe("Calories Counter");
    expect(m.short_name).toBe("Calories");
  });

  it("opens at the home page, standalone", () => {
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
  });

  it("has a theme and a background colour, as hex", () => {
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("has 192 px, 512 px and maskable 512 px icons", () => {
    expect(m.icons).toEqual(
      expect.arrayContaining([
        {
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ]),
    );
  });

  it("describes the app, in Australian English", () => {
    expect(m.description).toBeTruthy();
    expect(m.lang).toBe("en-AU");
  });

  it("stays within the app's own address, so installing never leaves it", () => {
    expect(m.scope).toBe("/");
    expect(m.id).toBe("/");
  });
});
