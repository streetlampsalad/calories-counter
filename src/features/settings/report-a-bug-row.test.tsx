import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportABugRow } from "./report-a-bug-row";

describe("ReportABugRow", () => {
  it("leads to the Report a bug form (US1.1)", () => {
    render(<ReportABugRow />);

    expect(screen.getByRole("link", { name: /Report a bug/ })).toHaveAttribute(
      "href",
      "/settings/report-a-bug",
    );
  });
});
