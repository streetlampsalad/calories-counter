import { describe, expect, it, vi } from "vitest";
import { createFeatureIssues, gitHubFeatureIssues } from "./feature-issues";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 201 });

describe("gitHubFeatureIssues", () => {
  it("creates an Issue on the repo with the token", async () => {
    const fetchImpl = vi.fn(async () => ok({ number: 321 }));
    const issues = gitHubFeatureIssues("token-123", fetchImpl);

    expect(
      await issues.create({
        title: "Feature: x",
        body: "b",
        labels: ["feature"],
      }),
    ).toEqual({ number: 321 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://api.github.com/repos/streetlampsalad/calories-counter/issues",
    );
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-123",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      title: "Feature: x",
      body: "b",
      labels: ["feature"],
    });
  });

  it("fails when GitHub refuses", async () => {
    const issues = gitHubFeatureIssues(
      "token-123",
      vi.fn(async () => new Response("{}", { status: 403 })),
    );

    await expect(
      issues.create({ title: "t", body: "b", labels: [] }),
    ).rejects.toThrow("403");
  });

  it("closes an Issue as not planned, after commenting why", async () => {
    const fetchImpl = vi.fn(async () => ok({}));
    await gitHubFeatureIssues("token-123", fetchImpl).close(321, "Withdrawn.");

    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(
      calls.map(([url, init]) => [init.method, url.split("/repos/")[1]]),
    ).toEqual([
      ["POST", "streetlampsalad/calories-counter/issues/321/comments"],
      ["PATCH", "streetlampsalad/calories-counter/issues/321"],
    ]);
    expect(JSON.parse(calls[1][1].body as string)).toEqual({
      state: "closed",
      state_reason: "not_planned",
    });
  });
});

describe("gitHubFeatureIssues labels", () => {
  it("adds labels to an Issue", async () => {
    const fetchImpl = vi.fn(async () => ok([]));
    await gitHubFeatureIssues("token-123", fetchImpl).addLabels(901, [
      "ready-for-agent",
    ]);

    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0][0]).toContain("/issues/901/labels");
    expect(calls[0][1].method).toBe("POST");
    expect(JSON.parse(calls[0][1].body as string)).toEqual({
      labels: ["ready-for-agent"],
    });
  });
});

describe("createFeatureIssues", () => {
  it("never calls GitHub when faked, and numbers each Issue uniquely", async () => {
    const issues = createFeatureIssues({ FEATURE_ISSUES: "fake" });
    const first = await issues.create({ title: "t", body: "b", labels: [] });
    const second = await issues.create({ title: "t", body: "b", labels: [] });

    expect(second.number).toBe(first.number + 1);
    expect(first.number).toBeGreaterThan(90000);
  });

  it("fails every call when there is no token", async () => {
    await expect(
      createFeatureIssues({}).create({ title: "t", body: "b", labels: [] }),
    ).rejects.toThrow("GITHUB_FEATURE_REQUESTS_TOKEN");
  });
});
