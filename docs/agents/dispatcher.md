# The Dispatcher

The Dispatcher is a Claude Code routine (a scheduled cloud agent) that keeps work moving with no human starting sessions. `scripts/setup-workflow.sh` walks the owner through creating it at claude.ai/code.

## Settings

- **Repository**: `streetlampsalad/calories-counter`
- **Environment**: the cloud environment with the setup script `bash scripts/cloud-setup.sh` (ADR 0006)
- **Triggers**: hourly, and when a pull request into `main` is merged
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
