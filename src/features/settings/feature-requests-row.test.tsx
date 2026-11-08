import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useToggle = vi.fn();
vi.mock("@/features/toggles/queries", () => ({
  useToggle: (key: string) => useToggle(key),
}));

import { FeatureRequestsRow } from "./feature-requests-row";

describe("FeatureRequestsRow", () => {
  it("leads to the Feature requests list while its Toggle is on (US1.1)", () => {
    useToggle.mockReturnValue(true);
    render(<FeatureRequestsRow />);

    expect(useToggle).toHaveBeenCalledWith("feature-114");
    expect(
      screen.getByRole("link", { name: /Feature requests/ }),
    ).toHaveAttribute("href", "/settings/feature-requests");
  });

  it("is not there while its Toggle is off (US1.2)", () => {
    useToggle.mockReturnValue(false);
    const { container } = render(<FeatureRequestsRow />);

    expect(container).toBeEmptyDOMElement();
  });
});
