# Writing the pull request

The body follows [`.github/pull_request_template.md`](../../../.github/pull_request_template.md). Keep its headings and its order.

## Every pull request

- **Title**: what a User or the owner gets, in the glossary's terms (`See the Day grouped by Meal time`). The Issue number goes in the body.
- **First line**: `Refs #<issue>`. Never a closing keyword: the Issue closes when the change is in production.
- **What changed**: the behaviour first, then the parts that carry it. Name the Toggle and what the app does with it off. Say when the spec was corrected, and why.
- **How it was tested**: one line per acceptance criterion, with the test that proves it. Say which tests only CI ran (pgTAP and e2e, from a cloud session).
- **Risk assessment**: tick every condition that applies and leave the rest of the list in place. With none ticked, say so in one line.

## A pull request that needs Human review

Fill `## For the reviewer` when you ticked any risk condition, or when the diff touches what the merge gate flags on its own: a guardrail file (`scripts/workflow/gates.mjs` lists them), a dependency, a destructive or RLS migration, or a new environment variable. When the merge gate adds `needs-human-review` after you opened the pull request, add the section then. Otherwise delete the section.

The reader is the owner, on a phone, who has not read the diff and should be able to decide from this section which parts to open. Write it in **plain words**: short sentences, the glossary's terms, and no file path, function name or library name until **Read first**. Explain an idea a newcomer would not know in half a sentence the first time it appears.

Its five parts, in this order:

1. **Why a human** — each reason this pull request was flagged, as a consequence: "it changes who can read Entries", not "touches RLS".
2. **In plain words** — two to four sentences: what was wrong or missing, and what happens now.
3. **How it works** — pseudocode for each risky part, in a code block. One block per part, at most about twelve lines, written as `when` / `if` / `for each` steps a non-programmer could follow. Use the glossary's nouns in place of variable names. Show the decision the code makes and leave out the plumbing. Where the change replaces a rule, show **Before** and **After**.
4. **Read first** — the files that carry the risk, in the order to read them, each with one line on what to check there. Then one line naming what is safe to skim (tests, generated types, copy).
5. **If it goes wrong** — what a User would see, and how to undo it: turn the Toggle off, revert the pull request, or say plainly that it cannot be undone and why.

Add **Try it** (where to tap, with the Toggle key) when there is something to see on a phone.

### Example

```markdown
## For the reviewer

**Why a human**
- It changes which Entries one User can read (the row-level security rule on Entries).
- It cannot be fully proved in CI: the reminder is sent by a real push service.

**In plain words**
A User could not share a Day with a friend. Now a User can invite one friend, and that friend can read (never change) the User's Entries for the Days they were invited to.

**How it works**

Who can read an Entry:

    Before:
      allow if the Entry belongs to the person asking

    After:
      allow if the Entry belongs to the person asking
      or if the Entry's owner invited the person asking
         and the invitation covers the Entry's Day
         and the invitation has not been withdrawn

Changing or deleting an Entry is as before: only its owner.

**Read first**
1. `supabase/migrations/…_shared_days.sql`: the new rule matches the pseudocode above, and nothing else was loosened.
2. `supabase/tests/database/shared-days.test.sql`: a stranger and a withdrawn friend both read nothing.
3. `src/features/sharing/server.ts`: an invitation can only be made by the Day's owner.

Safe to skim: the component tests, `database.types.ts`, the copy.

**Try it**
Turn on Toggle `feature-201`, open a Day, tap Share, invite a second account, and open the link signed in as that account.

**If it goes wrong**
A friend would see Days they were not invited to. Turn Toggle `feature-201` off: sharing disappears and the old rule's behaviour returns. The migration only adds a table and a rule, so reverting loses no data.
```

Done when the owner could approve or reject from this section alone, every risk condition you ticked appears under **Why a human**, and each pseudocode block still matches the code after your last commit.
