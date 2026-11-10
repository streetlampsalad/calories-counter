# The Dispatcher

The Dispatcher is a Claude Code routine (a scheduled cloud agent) that keeps work moving with no human starting sessions. `scripts/setup-workflow.sh` walks the owner through creating it at claude.ai/code.

## Settings

- **Repository**: `streetlampsalad/calories-counter`
- **Environment**: a cloud environment whose setup script is `cd /home/user/calories-counter && bash scripts/cloud-setup.sh`. Setup runs outside the repo, so a bare `bash scripts/cloud-setup.sh` fails with "No such file or directory". Pasting the script's contents fails too, at `.nvmrc`.
- **Triggers**:
  - hourly;
  - a GitHub trigger for a pull request closed into `main` with "Is merged" true;
  - an API trigger. Its fire URL is the repository variable `DISPATCHER_FIRE_URL` and its token is the secret `DISPATCHER_FIRE_TOKEN`. [`.github/workflows/dispatcher.yml`](../../.github/workflows/dispatcher.yml) fires it when an Issue event gives the Dispatcher work: a Feature or Bug opened for triage, an Issue opened with or given `ready-for-agent` (but not a new Slice, since the run that creates Slices carries on to the first), an Issue closed (which can unblock the next Slice), unassigned or reopened, or `needs-human-review` or `human-step` removed. Only the owner's events count, and it waits two minutes so a burst of events starts one run. Runs can still overlap, so `/deliver`'s claim checks that no other run claimed the Issue first. Generating a new token revokes the old one, so update the secret whenever you do.
- **Model**: the most capable model the routine offers. The routine's session does the thinking: triage, specs, Bugs, the self-review and the pull request. Building a Slice or a mechanical Chore runs in the `implementer` subagent (`.claude/agents/implementer.md`), whose own `model` setting picks a faster model, whatever the routine is set to.
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
