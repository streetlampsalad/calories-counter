// Thin wrappers over the gh CLI for the workflow scripts. gh reads GH_TOKEN from the
// environment; the workflows pass AUTOMATION_TOKEN so the events these scripts cause
// trigger further workflows (GITHUB_TOKEN events do not).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function gh(args, input) {
  const output = execFileSync("gh", args, {
    input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "inherit"],
  });
  return output.trim() ? JSON.parse(output) : null;
}

export const repo =
  process.env.GITHUB_REPOSITORY ?? "streetlampsalad/calories-counter";

/** A REST call. `path` is relative to the repository unless it starts with "/". */
export function rest(method, path, body) {
  const url = path.startsWith("/") ? path : `/repos/${repo}/${path}`;
  const args = ["api", "--method", method, url];
  if (body === undefined) return gh(args);
  return gh([...args, "--input", "-"], JSON.stringify(body));
}

/** Every page of a REST list. */
export function restAll(path) {
  const url = path.startsWith("/") ? path : `/repos/${repo}/${path}`;
  const pages = gh(["api", "--paginate", "--slurp", url]);
  return pages.flat();
}

export function graphql(query, variables = {}) {
  const result = gh(
    ["api", "graphql", "--input", "-"],
    JSON.stringify({ query, variables }),
  );
  return result.data;
}

export function readEvent() {
  const path = process.env.GITHUB_EVENT_PATH;
  return {
    name: process.env.GITHUB_EVENT_NAME ?? "workflow_dispatch",
    payload: path ? JSON.parse(readFileSync(path, "utf8")) : {},
  };
}
