// PostToolUse: format and auto-fix the file Claude just wrote, so lint noise
// never reaches the pre-commit hook. Never blocks.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const filePath = input.tool_input?.file_path;

if (filePath && /\.(m?[jt]sx?|jsonc?|css)$/.test(filePath)) {
  spawnSync(
    "pnpm",
    [
      "exec",
      "biome",
      "check",
      "--write",
      "--no-errors-on-unmatched",
      "--files-ignore-unknown=true",
      filePath,
    ],
    {
      cwd: process.env.CLAUDE_PROJECT_DIR,
      stdio: "ignore",
      shell: process.platform === "win32",
    },
  );
}
process.exit(0);
