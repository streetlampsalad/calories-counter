import { describe, expect, it } from "vitest";
import { wakesDispatcher } from "./dispatcher.mjs";

const OWNER = "streetlampsalad";
const event = (action, { labels = [], label, sender = OWNER } = {}) => ({
  action,
  issue: { labels: labels.map((name) => ({ name })) },
  ...(label ? { label: { name: label } } : {}),
  sender: { login: sender },
});

describe("wakesDispatcher", () => {
  it("wakes for a new Feature or Bug to triage, such as an in-app Feature Request", () => {
    expect(
      wakesDispatcher(
        event("opened", { labels: ["feature", "needs-triage"] }),
        OWNER,
      ),
    ).toBe(true);
    expect(
      wakesDispatcher(
        event("opened", { labels: ["bug", "needs-triage"] }),
        OWNER,
      ),
    ).toBe(true);
  });

  it("wakes for an Issue opened or labelled ready-for-agent, such as a new Spec or clean-up Chore", () => {
    expect(
      wakesDispatcher(
        event("opened", { labels: ["spec", "ready-for-agent"] }),
        OWNER,
      ),
    ).toBe(true);
    expect(
      wakesDispatcher(event("labeled", { label: "ready-for-agent" }), OWNER),
    ).toBe(true);
  });

  it("wakes when an Issue closes, which can unblock the next Slice", () => {
    expect(wakesDispatcher(event("closed"), OWNER)).toBe(true);
  });

  it("wakes when the owner hands an Issue back by removing needs-human-review or human-step", () => {
    expect(
      wakesDispatcher(
        event("unlabeled", { label: "needs-human-review" }),
        OWNER,
      ),
    ).toBe(true);
    expect(
      wakesDispatcher(event("unlabeled", { label: "human-step" }), OWNER),
    ).toBe(true);
  });

  it("sleeps through events that cannot give it work", () => {
    expect(wakesDispatcher(event("opened", { labels: ["chore"] }), OWNER)).toBe(
      false,
    );
    expect(
      wakesDispatcher(event("labeled", { label: "priority:P1" }), OWNER),
    ).toBe(false);
    expect(
      wakesDispatcher(event("labeled", { label: "needs-human-review" }), OWNER),
    ).toBe(false);
    expect(
      wakesDispatcher(event("unlabeled", { label: "ready-for-agent" }), OWNER),
    ).toBe(false);
    expect(wakesDispatcher(event("edited"), OWNER)).toBe(false);
  });

  it("wakes only for the owner, so a stranger's Issue on this public repo starts no run", () => {
    expect(
      wakesDispatcher(
        event("opened", {
          labels: ["feature", "needs-triage"],
          sender: "someone",
        }),
        OWNER,
      ),
    ).toBe(false);
    expect(wakesDispatcher(event("closed", { sender: "someone" }), OWNER)).toBe(
      false,
    );
  });
});
