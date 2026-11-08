import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FeatureRequest } from "./queries";

const useFeatureRequestsAhead = vi.fn();
vi.mock("./queries", () => ({
  useFeatureRequestsAhead: (id: string, enabled: boolean) =>
    useFeatureRequestsAhead(id, enabled),
  useWithdrawFeatureRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useGiveFeedback: () => ({ mutate: vi.fn(), isPending: false }),
  useDecide: () => ({ mutate: vi.fn(), isPending: false }),
  useMyFeatureRequests: () => ({ data: [] }),
}));

const switchToggle = vi.fn();
vi.mock("@/features/toggles/queries", () => ({
  useSwitchToggle: () => ({ mutate: switchToggle }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { OtherRequestCard, RequestCard } from "./request-card";

const request = (overrides: Partial<FeatureRequest> = {}): FeatureRequest => ({
  id: "r1",
  goal: "Track water as well as food",
  stage: "planning",
  featureIssue: 200,
  latestComment: "Accepted: specified in #201",
  readyNote: null,
  withdrawnAt: null,
  firstReadyAt: null,
  rounds: [],
  createdAt: "2026-11-08T00:00:00Z",
  ...overrides,
});

describe("RequestCard", () => {
  it("shows what was asked, its stage, the latest comment and the Issue (US2.1)", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    render(<RequestCard request={request()} display="planning" />);

    const card = screen.getByRole("article", {
      name: "Track water as well as food",
    });
    expect(card).toHaveTextContent("Planning");
    expect(card).toHaveTextContent("Accepted: specified in #201");
    expect(
      screen.getByRole("link", { name: "See it on GitHub" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/streetlampsalad/calories-counter/issues/200",
    );
  });

  it("gives the reason when it is Not going ahead (US2.5)", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    render(
      <RequestCard
        request={request({
          stage: "not_going_ahead",
          latestComment: "A duplicate of #12.",
        })}
        display="not_going_ahead"
      />,
    );

    expect(screen.getByText("Not going ahead")).toBeInTheDocument();
    expect(screen.getByText("Why: A duplicate of #12.")).toBeInTheDocument();
  });

  it("says how many requests are ahead while it is Submitted", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: 2 });
    render(
      <RequestCard
        request={request({ stage: "submitted" })}
        display="submitted"
      />,
    );

    expect(useFeatureRequestsAhead).toHaveBeenCalledWith("r1", true);
    expect(screen.getByText("2 requests ahead of yours")).toBeInTheDocument();
  });

  it("says when it is next", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: 0 });
    render(
      <RequestCard
        request={request({ stage: "submitted" })}
        display="submitted"
      />,
    );

    expect(screen.getByText("Yours is next")).toBeInTheDocument();
  });

  it("doesn't ask about the queue once triage has started", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    render(
      <RequestCard
        request={request({ stage: "building" })}
        display="building"
      />,
    );

    expect(useFeatureRequestsAhead).toHaveBeenCalledWith("r1", false);
    expect(screen.queryByText(/ahead of yours/)).not.toBeInTheDocument();
  });
});

describe("OtherRequestCard", () => {
  it("shows what was asked and its stage, never who asked (US2.4)", () => {
    render(<OtherRequestCard goal="Scan barcodes" display="building" />);

    const card = screen.getByRole("article", { name: "Scan barcodes" });
    expect(card).toHaveTextContent("Building");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("RequestCard and Withdraw (US4)", () => {
  it("offers Withdraw before building starts (US4.1)", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    for (const display of [
      "submitted",
      "being_reviewed",
      "planning",
    ] as const) {
      const { unmount } = render(
        <RequestCard request={request({ stage: display })} display={display} />,
      );
      expect(
        screen.getByRole("button", { name: "Withdraw" }),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("doesn't once building has started, nor after (US4.2)", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    for (const display of [
      "building",
      "waiting_for_owner",
      "ready_to_try",
      "withdrawn",
    ] as const) {
      const { unmount } = render(
        <RequestCard request={request()} display={display} />,
      );
      expect(
        screen.queryByRole("button", { name: "Withdraw" }),
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it("says Withdrawn once withdrawn", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    render(
      <RequestCard
        request={request({ withdrawnAt: "2026-11-08T00:00:00Z" })}
        display="withdrawn"
      />,
    );

    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
  });
});

describe("RequestCard at Ready to try (US3)", () => {
  const ready = request({
    stage: "ready_to_try",
    readyNote:
      "Open Settings, then Water.\n\nGuesses made: glasses, not millilitres.",
  });

  it("shows the agent's note on what was built and how to try it (US3.4)", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    render(
      <RequestCard
        request={ready}
        display="ready_to_try"
        toggle={{
          key: "feature-200",
          isOn: false,
          canSwitch: true,
          state: "testing",
        }}
      />,
    );

    expect(screen.getByText(/Open Settings, then Water\./)).toBeInTheDocument();
    expect(
      screen.getByText(/Guesses made: glasses, not millilitres\./),
    ).toBeInTheDocument();
  });

  it("has a switch that turns the feature on for the Requester (US3.5)", async () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    render(
      <RequestCard
        request={ready}
        display="ready_to_try"
        toggle={{
          key: "feature-200",
          isOn: false,
          canSwitch: true,
          state: "testing",
        }}
      />,
    );

    const tryIt = screen.getByRole("switch", { name: "Try it" });
    expect(tryIt).not.toBeChecked();
    await userEvent.click(tryIt);

    expect(switchToggle).toHaveBeenCalledWith(
      { key: "feature-200", on: true },
      expect.any(Object),
    );
  });

  it("shows the switch on when the feature is on for them", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    render(
      <RequestCard
        request={ready}
        display="ready_to_try"
        toggle={{
          key: "feature-200",
          isOn: true,
          canSwitch: true,
          state: "testing",
        }}
      />,
    );

    expect(screen.getByRole("switch", { name: "Try it" })).toBeChecked();
  });

  it("has no switch until the Requester may switch it", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    render(
      <RequestCard
        request={ready}
        display="ready_to_try"
        toggle={{
          key: "feature-200",
          isOn: false,
          canSwitch: false,
          state: "testing",
        }}
      />,
    );

    expect(
      screen.queryByRole("switch", { name: "Try it" }),
    ).not.toBeInTheDocument();
  });

  it("has no switch at any other stage", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    render(
      <RequestCard
        request={request({ stage: "building" })}
        display="building"
        toggle={{
          key: "feature-200",
          isOn: false,
          canSwitch: true,
          state: "testing",
        }}
      />,
    );

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});

describe("RequestCard and Rounds (spec 135 US1)", () => {
  const testing = {
    key: "feature-200",
    isOn: true,
    canSwitch: true,
    state: "testing" as const,
  };
  const tried = "2026-11-01T00:00:00Z";

  it("offers Give feedback at Ready to try with its Toggle in Testing (US1.1)", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    render(
      <RequestCard
        request={request({ stage: "ready_to_try", firstReadyAt: tried })}
        display="ready_to_try"
        toggle={testing}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Give feedback" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "It's ready" }),
    ).toBeInTheDocument();
  });

  it("doesn't once the Toggle is Live or Removed, nor at any other stage (US1.8)", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    for (const [display, state] of [
      ["live", "live"],
      ["removed", "removed"],
      ["building", "testing"],
      ["submitted", "testing"],
    ] as const) {
      const { unmount } = render(
        <RequestCard
          request={request({ stage: "ready_to_try", firstReadyAt: tried })}
          display={display}
          toggle={{ ...testing, state }}
        />,
      );
      expect(
        screen.queryByRole("button", { name: "Give feedback" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "It's ready" }),
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it("lists each Round with its feedback and Issue (US1.3)", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    render(
      <RequestCard
        request={request({
          stage: "submitted",
          firstReadyAt: tried,
          rounds: [
            {
              id: "x1",
              feedback: "Let me add half a glass",
              featureIssue: 811,
              createdAt: "2026-11-08T00:00:00Z",
            },
          ],
        })}
        display="submitted"
        toggle={testing}
      />,
    );

    const rounds = screen.getByRole("list", { name: "Rounds" });
    expect(rounds).toHaveTextContent("Round 2");
    expect(rounds).toHaveTextContent("Let me add half a glass");
    expect(
      screen.getByRole("link", { name: "Round 2 on GitHub" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/streetlampsalad/calories-counter/issues/811",
    );
  });

  it("keeps the switch while a Round is built (US1.6)", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    render(
      <RequestCard
        request={request({ stage: "building", firstReadyAt: tried })}
        display="building"
        toggle={testing}
      />,
    );

    expect(screen.getByRole("switch", { name: "Try it" })).toBeChecked();
  });

  it("offers no Withdraw once the request has been Ready to try (US1.11)", () => {
    useFeatureRequestsAhead.mockReturnValue({ data: undefined });
    render(
      <RequestCard
        request={request({ stage: "submitted", firstReadyAt: tried })}
        display="submitted"
        toggle={testing}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Withdraw" }),
    ).not.toBeInTheDocument();
  });
});
