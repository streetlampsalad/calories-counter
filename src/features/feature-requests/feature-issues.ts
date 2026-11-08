import { REPOSITORY } from "./domain";

// Creates and closes the Feature Issues that Feature Requests become (spec 124). Server only: the
// token can write Issues on the public repo.
export type FeatureIssues = {
  create(input: {
    title: string;
    body: string;
    labels: string[];
  }): Promise<{ number: number }>;
  close(number: number, comment: string): Promise<void>;
};

type Env = Record<string, string | undefined>;

// FEATURE_ISSUES=fake (local and CI) never calls GitHub. Without a token either, every call fails,
// so a deployment that is not set up yet says it couldn't send the request.
export function createFeatureIssues(env: Env = process.env): FeatureIssues {
  if (env.FEATURE_ISSUES === "fake") return fakeFeatureIssues;
  const token = env.GITHUB_FEATURE_REQUESTS_TOKEN;
  if (!token) return unavailableFeatureIssues;
  return gitHubFeatureIssues(token);
}

export function gitHubFeatureIssues(
  token: string,
  fetchImpl: typeof fetch = fetch,
): FeatureIssues {
  async function call(method: string, path: string, body: unknown) {
    const response = await fetchImpl(
      `https://api.github.com/repos/${REPOSITORY}/${path}`,
      {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      throw new Error(
        `GitHub answered ${response.status} to ${method} ${path}`,
      );
    }
    return response.json() as Promise<{ number?: number }>;
  }

  return {
    async create({ title, body, labels }) {
      const issue = await call("POST", "issues", { title, body, labels });
      if (typeof issue.number !== "number")
        throw new Error("GitHub gave no Issue number");
      return { number: issue.number };
    },
    async close(number, comment) {
      await call("POST", `issues/${number}/comments`, { body: comment });
      await call("PATCH", `issues/${number}`, {
        state: "closed",
        state_reason: "not_planned",
      });
    },
  };
}

const unavailableFeatureIssues: FeatureIssues = {
  async create() {
    throw new Error("GITHUB_FEATURE_REQUESTS_TOKEN is not set");
  },
  async close() {
    throw new Error("GITHUB_FEATURE_REQUESTS_TOKEN is not set");
  },
};

// Numbers well clear of the real repo's, kept for the server's lifetime so each one is unique.
const fakeState = globalThis as { fakeFeatureIssueNumber?: number };
const fakeFeatureIssues: FeatureIssues = {
  async create() {
    fakeState.fakeFeatureIssueNumber =
      (fakeState.fakeFeatureIssueNumber ?? 90000 + (Date.now() % 9000) * 10) +
      1;
    return { number: fakeState.fakeFeatureIssueNumber };
  },
  async close() {},
};
