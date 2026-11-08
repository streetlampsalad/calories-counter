# The Dispatcher

The Dispatcher is a Claude Code routine (a scheduled cloud agent) that keeps work moving with no human starting sessions. `scripts/setup-workflow.sh` walks the owner through creating it at claude.ai/code.

## Settings

- **Repository**: `streetlampsalad/calories-counter`
- **Environment**: a cloud environment whose setup script is `cd /home/user/calories-counter && bash scripts/cloud-setup.sh`. Setup runs outside the repo, so a bare `bash scripts/cloud-setup.sh` fails with "No such file or directory". Pasting the script's contents fails too, at `.nvmrc`.
- **Triggers**: hourly, and a GitHub trigger for a pull request closed into `main` with "Is merged" true.
- **Allowed tools**: Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, Agent, Task and Skill. `/deliver` runs its self-review in a subagent, which needs `Agent` (`Task` in older sessions).
- **Connectors**: Context7 only. A new routine gets every account connector, so remove the rest. Supabase and Vercel especially: the guard hook (`.claude/hooks/guard.mjs`) sees only shell commands and file edits, not MCP tools, so they would let a run reach production around it.
- **Prompt**: the block below, verbatim

## Prompt

```text
/deliver next

You are the Dispatcher for this repository. Deliver exactly one Issue, following the
deliver skill and docs/agents/workflow.md, then stop. If no Issue qualifies, say so in
one line and stop without changing anything.
```

## Why one Issue per run

Each run is short and stateless, so a reclaimed cloud machine loses nothing, the board stays accurate between runs, and usage of the owner's plan stays even. A run that creates a Spec's Slices (no pull request) carries straight on to the first Slice.
