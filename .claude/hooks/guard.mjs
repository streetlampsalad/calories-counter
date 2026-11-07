// PreToolUse guard for Claude Code. Exit code 2 blocks the tool call and shows
// the message to the agent. Every rule here backs a rule in AGENTS.md.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const tool = input.tool_name;
const args = input.tool_input ?? {};

function block(reason) {
  console.error(`Blocked by .claude/hooks/guard.mjs: ${reason}`);
  process.exit(2);
}

if (tool === "Bash" || tool === "PowerShell") {
  const cmd = String(args.command ?? "");
  if (/--no-verify\b/.test(cmd) || /\bgit\s+commit\b.*\s-n\b/.test(cmd)) {
    block(
      "git hooks are the quality gate (docs/adr/0007). Fix the failure instead of skipping hooks.",
    );
  }
  if (
    /\bgit\s+push\b[^|;&]*(?:\s|:|\/)(?:refs\/heads\/)?main(?=\s|$)/.test(cmd)
  ) {
    block(
      "every change reaches main through a pull request (docs/adr/0007). Push your branch and open one.",
    );
  }
  if (
    /\bgh\s+pr\s+merge\b/.test(cmd) ||
    /\bgh\s+api\b.*\/pulls\/\d+\/merge\b/.test(cmd) ||
    /\bmergePullRequest\b/.test(cmd)
  ) {
    block(
      "the merge gate merges pull requests (docs/adr/0007). Leave the merge to it, or to the owner.",
    );
  }
  if (
    /needs-human-review/.test(cmd) &&
    (/--remove-label\b/.test(cmd) ||
      /(?:^|\s)(?:-X|--method)\s*(?:DELETE|PUT)\b/.test(cmd) ||
      /\bremoveLabelsFromLabelable\b/.test(cmd))
  ) {
    block(
      "only the repo owner removes needs-human-review (docs/agents/workflow.md). Leave it for them.",
    );
  }
  if (/\bgit\s+push\b.*(--force\b|--force-with-lease\b|\s-f\b)/.test(cmd)) {
    block(
      "force-pushing main rewrites shared history. Add a new commit instead.",
    );
  }
  if (
    /\bsupabase\s+db\s+(push|reset\s+.*--linked)/.test(cmd) ||
    /\bsupabase\s+.*--linked\b.*\b(reset|push)\b/.test(cmd)
  ) {
    block(
      "production migrations are applied only by the deploy workflow. Use the local stack (pnpm db:reset).",
    );
  }
  process.exit(0);
}

const filePath = args.file_path ?? args.notebook_path;
if (!filePath) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const rel = path
  .relative(projectDir, path.resolve(filePath))
  .split(path.sep)
  .join("/");
const base = path.basename(rel);

if (base.startsWith(".env") && base !== ".env.example") {
  block(
    `${rel} holds secrets. Document new variables in .env.example and ask the human to set them.`,
  );
}

if (rel === "src/lib/supabase/database.types.ts") {
  block(
    "database.types.ts is generated. Change the schema with a migration, then run pnpm db:types.",
  );
}

if (rel.startsWith("supabase/migrations/")) {
  let committed = false;
  try {
    execFileSync("git", ["cat-file", "-e", `HEAD:${rel}`], {
      cwd: projectDir,
      stdio: "ignore",
    });
    committed = true;
  } catch {
    // Not in HEAD: a new migration, which is fine to write.
  }
  if (committed) {
    block(
      `${rel} is already committed and may be applied in production. Create a new migration with pnpm db:new <name>.`,
    );
  }
}

process.exit(0);
