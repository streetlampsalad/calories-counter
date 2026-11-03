import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AboutSection } from "./about-section";
import { formatVersion } from "./version";

describe("formatVersion", () => {
  it("shortens a full commit to seven characters", () => {
    expect(formatVersion("b6ee534831843516ff5430d5344271c91709a67d")).toBe(
      "b6ee534",
    );
  });

  it("keeps something already short", () => {
    expect(formatVersion("abc12")).toBe("abc12");
  });

  it.each([
    undefined,
    "",
    "   ",
  ])("says development when there is no commit (%j)", (value) => {
    expect(formatVersion(value)).toBe("development");
  });
});

describe("AboutSection", () => {
  it("shows which version of the app this is", () => {
    render(<AboutSection version="b6ee534" />);

    expect(screen.getByText("Version b6ee534")).toBeInTheDocument();
  });

  it("credits the Australian food data and Open Food Facts", () => {
    render(<AboutSection version="dev" />);

    expect(
      screen.getByText(/Australian Food Composition Database/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Food Standards Australia New Zealand/),
    ).toBeInTheDocument();
    const openFoodFacts = screen.getByRole("link", { name: "Open Food Facts" });
    expect(openFoodFacts).toHaveAttribute(
      "href",
      "https://world.openfoodfacts.org",
    );
    expect(openFoodFacts).toHaveAttribute(
      "rel",
      expect.stringContaining("noopener"),
    );
    expect(screen.getByText(/Open Database Licence/)).toBeInTheDocument();
  });

  it("is upfront that photos and best guesses go to Google's free Gemini tier", () => {
    render(<AboutSection version="dev" />);

    const note = screen.getByText(/Gemini/);
    expect(note).toHaveTextContent("free tier");
    expect(note).toHaveTextContent(/improve Google's products/i);
  });

  it("has a heading, so it can be found by headings", () => {
    render(<AboutSection version="dev" />);

    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
  });
});
