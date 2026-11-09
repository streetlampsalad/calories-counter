import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toaster } from "./sonner";

const sonner = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  Toaster: (props: { theme?: string }) => {
    sonner(props.theme);
    return null;
  },
}));
let state = { theme: "system", resolvedTheme: "dark" };
vi.mock("next-themes", () => ({ useTheme: () => state }));

describe("Toaster", () => {
  it("uses the resolved theme (US2.3)", () => {
    state = { theme: "system", resolvedTheme: "dark" };
    render(<Toaster />);
    expect(sonner).toHaveBeenLastCalledWith("dark");
  });

  it("is light when the theme has not resolved (US2.4)", () => {
    state = { theme: "light", resolvedTheme: undefined as unknown as string };
    render(<Toaster />);
    expect(sonner).toHaveBeenLastCalledWith("light");
  });
});
