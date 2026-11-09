import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeatureRequestsRow } from "./feature-requests-row";

describe("FeatureRequestsRow", () => {
  it("leads to the Feature requests list (US1.1)", () => {
    render(<FeatureRequestsRow />);

    expect(
      screen.getByRole("link", { name: /Feature requests/ }),
    ).toHaveAttribute("href", "/settings/feature-requests");
  });
});
