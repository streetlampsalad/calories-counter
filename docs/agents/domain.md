# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase. This is a single-context repo.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root: the glossary.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

Both exist in this repo. A Spec pull request adds any new term to `CONTEXT.md`; a decision that is hard to reverse gets an ADR (the `/domain-modeling` skill, where it is installed).

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-entries-reference-foods-live.md
│   ├── 0002-google-sign-in-only.md
│   └── ...
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0003 (trunk-based with gated deploys), but worth reopening because…_
