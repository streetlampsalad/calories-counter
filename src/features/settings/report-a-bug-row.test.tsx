import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let on: boolean;
const useToggle = vi.fn((_key: string) => on);
vi.mock("@/features/toggles/queries", () => ({
  useToggle: (key: string) => useToggle(key),
}));

import { ReportABugRow } from "./report-a-bug-row";

describe("ReportABugRow", () => {
  beforeEach(() => {
    on = true;
    useToggle.mockClear();
  });

  it("leads to the Report a bug form while feature-192 is on (US1.1)", () => {
    render(<ReportABugRow />);

    expect(useToggle).toHaveBeenCalledWith("feature-192");
    expect(screen.getByRole("link", { name: /Report a bug/ })).toHaveAttribute(
      "href",
      "/settings/report-a-bug",
    );
  });

  it("shows nothing while the Toggle is off (US1.2)", () => {
    on = false;
    const { container } = render(<ReportABugRow />);

    expect(container).toBeEmptyDOMElement();
  });
});
