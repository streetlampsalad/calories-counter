import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useBugReports = vi.fn();
vi.mock("./queries", () => ({ useBugReports: () => useBugReports() }));

import { ReportList } from "./report-list";

const report = (overrides = {}) => ({
  id: "r1",
  bugIssue: 301,
  outcome: "being_fixed",
  issueTitle: "Bug: the total is wrong",
  latestComment: null,
  createdAt: "2026-11-10T00:00:00Z",
  ...overrides,
});

const rows = () =>
  within(screen.getByRole("list", { name: "Your bug reports" })).getAllByRole(
    "listitem",
  );

describe("ReportList", () => {
  beforeEach(() => useBugReports.mockReset());

  it("shows nothing for a User with no reports (US3.5)", () => {
    useBugReports.mockReturnValue({ isPending: false, data: [] });
    const { container } = render(<ReportList />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows placeholders, no list, while loading (US3.5)", () => {
    useBugReports.mockReturnValue({ isPending: true });
    render(<ReportList />);

    expect(
      screen.getByRole("heading", { name: "Your bug reports" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("says so, with Retry, when the list can't load (US3.5)", async () => {
    const refetch = vi.fn();
    useBugReports.mockReturnValue({ isPending: false, isError: true, refetch });
    render(<ReportList />);

    expect(
      screen.getByText(/Couldn't load your bug reports/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("lists the reports in the order given, each with its title, outcome and a link to the Issue (US3.5)", () => {
    useBugReports.mockReturnValue({
      isPending: false,
      data: [
        report({
          id: "new",
          bugIssue: 302,
          issueTitle: "Bug: newer",
          outcome: "fixed",
        }),
        report({
          id: "old",
          bugIssue: 301,
          issueTitle: "Bug: older",
          outcome: "waiting_for_owner",
        }),
      ],
    });
    render(<ReportList />);

    const [first, second] = rows();
    expect(first).toHaveAttribute("id", "new");
    expect(within(first).getByText("Bug: newer")).toBeInTheDocument();
    expect(within(first).getByText("Fixed")).toBeInTheDocument();
    expect(
      within(first).getByRole("link", { name: /See it on GitHub/ }),
    ).toHaveAttribute(
      "href",
      "https://github.com/streetlampsalad/calories-counter/issues/302",
    );
    expect(second).toHaveAttribute("id", "old");
    expect(
      within(second).getByText("Waiting for the owner"),
    ).toBeInTheDocument();
  });

  it("names each outcome (US3.2, US3.5)", () => {
    useBugReports.mockReturnValue({
      isPending: false,
      data: [
        report({ id: "a", outcome: null }),
        report({ id: "b", outcome: "sent" }),
        report({ id: "c", outcome: "being_fixed" }),
        report({ id: "d", outcome: "not_going_ahead" }),
      ],
    });
    render(<ReportList />);

    expect(
      rows().map((row) => row.querySelector("[data-outcome]")?.textContent),
    ).toEqual(["Sent", "Sent", "Being fixed", "Not going ahead"]);
  });

  it("says Bug #<n> before the first sync (US3.5)", () => {
    useBugReports.mockReturnValue({
      isPending: false,
      data: [report({ issueTitle: null, outcome: null })],
    });
    render(<ReportList />);

    expect(within(rows()[0]).getByText("Bug #301")).toBeInTheDocument();
  });

  it("gives the reason in full, and a Feature requests link, for Not going ahead only (US3.5, US3.6)", () => {
    const reason = "That is how it is meant to work.\n".repeat(20).trim();
    useBugReports.mockReturnValue({
      isPending: false,
      data: [
        report({ id: "no", outcome: "not_going_ahead", latestComment: reason }),
        report({ id: "yes", outcome: "fixed", latestComment: "Fixed in 1.2" }),
      ],
    });
    render(<ReportList />);

    const [notGoing, fixed] = rows();
    expect(notGoing).toHaveTextContent(reason.replace(/\n/g, " "));
    expect(
      within(notGoing).getByRole("link", {
        name: "Is it something new? Ask for it as a feature.",
      }),
    ).toHaveAttribute("href", "/settings/feature-requests");
    expect(fixed).not.toHaveTextContent("Fixed in 1.2");
    expect(
      within(fixed).queryByRole("link", { name: /Ask for it/ }),
    ).not.toBeInTheDocument();
  });
});
