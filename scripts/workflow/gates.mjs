// Deterministic Human review rules for the merge gate (docs/adr/0007). They read only the
// pull request's diff and body, so nothing written in a Feature or a PR can talk past them.

// Changing any of these changes how work is checked, reviewed or deployed, or who can sign in.
const GUARDRAILS = [
  /^\.github\//,
  /^\.claude\//,
  /^\.specify\/(memory|templates|scripts)\//,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^docs\/adr\//,
  /^docs\/agents\//,
  /^lefthook\.yml$/,
  /^biome\.json$/,
  /^vercel\.json$/,
  /^next\.config\.ts$/,
  /^scripts\/(validate|check-no-secrets-in-client|cloud-setup)\./,
  /^scripts\/workflow\//,
  /^supabase\/config\.toml$/,
  /^src\/proxy\.ts$/,
  /^src\/lib\/supabase\//,
  /^src\/app\/auth\//,
];

// SQL that is irreversible or changes who can see which rows.
const RISKY_SQL =
  /\b(drop|rename|truncate|delete\s+from|alter\s+column|policy|row\s+level\s+security|grant|revoke|security\s+definer)\b/i;

// A dependency line in package.json: "name": "version-ish".
const DEPENDENCY_LINE =
  /^[+-]\s*"(@?[\w./-]+)":\s*"(?:[\^~>=<]*\d|\*|workspace:|npm:|github:|https?:)/;

const RISK_CHECKBOX = /^\s*[-*]\s*\[[xX]\]\s*(.+)$/;

function addedLines(patch) {
  return (patch ?? "")
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

function changedLines(patch) {
  return (patch ?? "")
    .split("\n")
    .filter(
      (line) =>
        (line.startsWith("+") && !line.startsWith("+++")) ||
        (line.startsWith("-") && !line.startsWith("---")),
    );
}

/**
 * Why a pull request needs Human review, judged from its files and body alone.
 * @param {{ filename: string, status?: string, patch?: string, previous_filename?: string }[]} files
 *   as returned by GET /repos/{owner}/{repo}/pulls/{number}/files
 * @param {string} [body] the pull request description
 * @returns {string[]} one reason per rule that matched; empty when auto-merge may proceed
 */
export function humanReviewReasons(files, body = "") {
  const reasons = new Set();

  for (const file of files) {
    const names = [file.filename, file.previous_filename].filter(Boolean);

    const guardrail = names.find((name) =>
      GUARDRAILS.some((rule) => rule.test(name)),
    );
    if (guardrail) reasons.add(`Changes a guardrail file: \`${guardrail}\``);

    if (
      file.filename === "pnpm-lock.yaml" ||
      file.filename === "pnpm-workspace.yaml"
    ) {
      reasons.add(`Changes dependencies: \`${file.filename}\``);
    }
    if (file.filename === "package.json") {
      const dependency = changedLines(file.patch).find((line) =>
        DEPENDENCY_LINE.test(line),
      );
      if (dependency)
        reasons.add("Adds, removes or upgrades a dependency in `package.json`");
      if (file.patch === undefined)
        reasons.add(
          "`package.json` changed but its diff is too large to inspect",
        );
    }

    if (file.filename.startsWith("supabase/migrations/")) {
      if (file.status !== "added") {
        reasons.add(`Edits a committed migration: \`${file.filename}\``);
      } else if (file.patch === undefined) {
        reasons.add(`Migration too large to inspect: \`${file.filename}\``);
      } else {
        const risky = addedLines(file.patch).find((line) =>
          RISKY_SQL.test(line.replace(/--.*$/, "")),
        );
        if (risky) {
          reasons.add(
            `Migration is irreversible or changes RLS: \`${file.filename}\` (\`${risky.trim()}\`)`,
          );
        }
      }
    }

    if (file.filename === ".env.example") {
      reasons.add("Changes the environment variables in `.env.example`");
    } else if (
      !/\.test\.[cm]?[jt]sx?$|^e2e\//.test(file.filename) &&
      addedLines(file.patch).some((line) => /\bprocess\.env\.[A-Z_]/.test(line))
    ) {
      reasons.add(`Reads an environment variable: \`${file.filename}\``);
    }
  }

  for (const ticked of tickedRiskConditions(body)) {
    reasons.add(`The author ticked a risk condition: ${ticked}`);
  }

  return [...reasons];
}

/** The ticked boxes under the "Risk assessment" heading of a pull request body. */
export function tickedRiskConditions(body) {
  const ticked = [];
  let inRisk = false;
  for (const line of (body ?? "").split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(line))
      inRisk = /^#{1,6}\s+risk assessment\b/i.test(line);
    else if (inRisk) {
      const match = line.match(RISK_CHECKBOX);
      if (match) ticked.push(match[1].trim());
    }
  }
  return ticked;
}
