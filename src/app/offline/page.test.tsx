import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OfflinePage from "./page";

describe("the offline page (AC-4)", () => {
  it("says the app is offline and why that matters", () => {
    render(<OfflinePage />);

    expect(
      screen.getByRole("heading", { name: "You're offline." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Logging needs a connection.")).toBeInTheDocument();
  });

  it("offers Retry, which starts the app again from the home page", () => {
    render(<OfflinePage />);

    expect(screen.getByRole("link", { name: "Retry" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
