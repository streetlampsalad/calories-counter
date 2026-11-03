import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AboutSection } from "@/features/settings/about-section";
import { FoodDataAttribution } from "./attribution";

describe("FoodDataAttribution (AC-10)", () => {
  it("credits both sources", () => {
    render(<FoodDataAttribution />);

    expect(
      screen.getByText(/Australian Food Composition Database/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Food Standards Australia New Zealand/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Open Database Licence/)).toBeInTheDocument();
  });

  it("links to Open Food Facts safely", () => {
    render(<FoodDataAttribution />);

    const link = screen.getByRole("link", { name: "Open Food Facts" });
    expect(link).toHaveAttribute("href", "https://world.openfoodfacts.org");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("says the same thing in Settings → About as under the results", () => {
    const { container: results } = render(<FoodDataAttribution />);
    const { container: about } = render(<AboutSection version="1.2.3" />);

    expect(about.textContent).toContain(results.textContent);
  });
});
