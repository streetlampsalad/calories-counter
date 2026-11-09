// When a push to main can reuse the merged pull request's CI rather than run `pnpm validate` again
// (.github/workflows/ci.yml, #161). A pull request's CI tests the merge of its branch with main at
// that moment and records that tree; the push reuses the result only when it is the same tree.

/** The artifact a pull request's passing CI uploads to record the tree it tested. */
export function testedTreeName(tree) {
  return `tested-tree-${tree}`;
}

/**
 * The id of the merged pull request's newest CI run if that run passed, else null. `runs` are the
 * CI runs for the pull request's head commit. A fork's pull request runs its own workflow file, so
 * its record is not trusted.
 */
export function reusablePullRequestRun(pull, runs, repository) {
  if (!pull.merged_at || pull.head?.repo?.full_name !== repository) return null;
  const newest = [...runs].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];
  return newest?.status === "completed" && newest.conclusion === "success"
    ? newest.id
    : null;
}
