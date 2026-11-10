<!--
  One pull request delivers one Issue (docs/agents/workflow.md).
  Use "Refs #n", never "Closes #n": the Issue closes when deploy.yml has the change in production.
-->

Refs #

## What changed

## How it was tested

<!-- The acceptance criteria this covers and the test that proves each one. -->

## For the reviewer

<!--
  Only when this needs Human review; otherwise delete this section.
  For the owner, in plain words (.claude/skills/deliver/pull-request.md).
-->

**Why a human**

**In plain words**

**How it works**

<!-- Pseudocode for each risky part: when / if / for each, in the glossary's terms. -->

**Read first**

**If it goes wrong**

## Risk assessment

<!-- Any tick needs `needs-human-review`. The merge gate also adds it for guardrail files, dependencies, destructive migrations and new environment variables. -->

- [ ] Adds a third-party integration, secret, environment variable or dashboard step
- [ ] Irreversible (drops or renames a column or table, or rewrites or deletes User data)
- [ ] Cannot be proved in CI (real device, real external API)
- [ ] Touches sign-in, RLS policies or what one User can see of another
- [ ] Changes the guardrails (CI, deploy, hooks, rulesets, AGENTS.md, constitution, workflow)
- [ ] Contradicts an ADR or needs a new one
