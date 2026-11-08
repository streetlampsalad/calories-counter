import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useMyFeatureRequests = vi.fn();
const useOtherFeatureRequests = vi.fn();
vi.mock("./queries", () => ({
  useMyFeatureRequests: () => useMyFeatureRequests(),
  useOtherFeatureRequests: () => useOtherFeatureRequests(),
  useFeatureRequestsAhead: () => ({ data: undefined }),
}));
const useToggles = vi.fn();
vi.mock("@/features/toggles/queries", () => ({
  useToggles: () => useToggles(),
}));

import { FeatureRequestsScreen } from "./request-list";

const mine = {
  id: "r1",
  goal: "Track water as well as food",
  stage: "ready_to_try",
  featureIssue: 200,
  latestComment: null,
  readyNote: null,
  withdrawnAt: null,
  firstReadyAt: "2026-11-01T00:00:00Z",
  rounds: [],
  createdAt: "2026-11-08T00:00:00Z",
};

describe("FeatureRequestsScreen", () => {
  beforeEach(() => {
    useOtherFeatureRequests.mockReturnValue({ data: [] });
    useToggles.mockReturnValue({ data: [] });
  });

  it("shows a placeholder while loading (US2.6)", () => {
    useMyFeatureRequests.mockReturnValue({ isPending: true });
    render(<FeatureRequestsScreen />);

    expect(
      screen.queryByRole("list", { name: "Your requests" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Nothing requested yet/)).not.toBeInTheDocument();
  });

  it("invites a first request when there are none (US2.6)", () => {
    useMyFeatureRequests.mockReturnValue({ isPending: false, data: [] });
    render(<FeatureRequestsScreen />);

    expect(screen.getByText(/Nothing requested yet/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a feature" }),
    ).toHaveAttribute("href", "/settings/feature-requests/new");
  });

  it("says so, with Retry, when the list can't load (US2.6)", async () => {
    const refetch = vi.fn();
    useMyFeatureRequests.mockReturnValue({
      isPending: false,
      isError: true,
      refetch,
    });
    render(<FeatureRequestsScreen />);

    expect(screen.getByText(/Couldn't load your requests/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows a request as Live for everyone once its Toggle is Live (US2.2)", () => {
    useMyFeatureRequests.mockReturnValue({ isPending: false, data: [mine] });
    useToggles.mockReturnValue({
      data: [{ key: "feature-200", state: "live" }],
    });
    render(<FeatureRequestsScreen />);

    expect(
      screen.getByRole("article", { name: "Track water as well as food" }),
    ).toHaveTextContent("Live for everyone");
  });

  it("lists what others are asking for, so nobody asks twice (US2.4)", () => {
    useMyFeatureRequests.mockReturnValue({ isPending: false, data: [] });
    useOtherFeatureRequests.mockReturnValue({
      data: [
        {
          id: "o1",
          goal: "Scan barcodes",
          stage: "building",
          featureIssue: 300,
        },
      ],
    });
    render(<FeatureRequestsScreen />);

    const others = screen.getByRole("list", { name: "Others are asking for" });
    expect(others).toHaveTextContent("Scan barcodes");
    expect(others).toHaveTextContent("Building");
  });

  it("leaves out the others' list when there is nothing in it", () => {
    useMyFeatureRequests.mockReturnValue({ isPending: false, data: [] });
    render(<FeatureRequestsScreen />);

    expect(
      screen.queryByRole("list", { name: "Others are asking for" }),
    ).not.toBeInTheDocument();
  });
});
