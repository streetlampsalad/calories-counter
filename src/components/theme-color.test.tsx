import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeColor } from "./theme-color";

let resolvedTheme: string | undefined = "dark";
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme }) }));

function addMeta(content: string, media?: string) {
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = content;
  if (media) meta.media = media;
  document.head.append(meta);
  return meta;
}

afterEach(() => {
  document.head.innerHTML = "";
  window.localStorage.clear();
});

describe("ThemeColor", () => {
  it("sets the theme colour to the chosen appearance (US2.2)", () => {
    window.localStorage.setItem("theme", "dark");
    const light = addMeta("#ffffff", "(prefers-color-scheme: light)");
    const dark = addMeta("#0a0a0a", "(prefers-color-scheme: dark)");
    resolvedTheme = "dark";
    render(<ThemeColor />);
    expect(light.content).toBe("#0a0a0a");
    expect(dark.content).toBe("#0a0a0a");
  });

  it("leaves the media pair alone when nothing is saved (US2.4)", () => {
    const light = addMeta("#ffffff", "(prefers-color-scheme: light)");
    const dark = addMeta("#0a0a0a", "(prefers-color-scheme: dark)");
    resolvedTheme = "light";
    render(<ThemeColor />);
    expect(light.content).toBe("#ffffff");
    expect(dark.content).toBe("#0a0a0a");
  });
});
