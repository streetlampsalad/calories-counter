import { describe, expect, it } from "vitest";
import { humanReviewReasons, tickedRiskConditions } from "./gates.mjs";

const file = (filename, patch, status = "modified") => ({
  filename,
  patch,
  status,
});

describe("humanReviewReasons", () => {
  it("lets an ordinary feature change through", () => {
    expect(
      humanReviewReasons([
        file(
          "src/features/foods/FoodList.tsx",
          "+export function FoodList() {}",
        ),
        file(
          "supabase/migrations/20261108000000_add_meal_groups.sql",
          "+create table public.meal_groups (id uuid primary key);",
          "added",
        ),
        file(
          "package.json",
          '-    "test": "vitest run",\n+    "test": "vitest run --silent",',
        ),
      ]),
    ).toEqual([]);
  });

  it.each([
    ".github/workflows/ci.yml",
    ".claude/hooks/guard.mjs",
    ".specify/memory/constitution.md",
    "AGENTS.md",
    "docs/adr/0008-something.md",
    "scripts/workflow/gates.mjs",
    "src/proxy.ts",
    "src/lib/supabase/server.ts",
  ])("flags a guardrail file: %s", (filename) => {
    expect(humanReviewReasons([file(filename, "+x")])).toEqual([
      `Changes a guardrail file: \`${filename}\``,
    ]);
  });

  it("flags a guardrail file that was moved away", () => {
    expect(
      humanReviewReasons([
        {
          filename: "old/ci.yml",
          previous_filename: ".github/workflows/ci.yml",
          status: "renamed",
        },
      ]),
    ).toHaveLength(1);
  });

  it("flags dependency changes", () => {
    expect(
      humanReviewReasons([
        file("package.json", '+    "left-pad": "^1.3.0",'),
        file("pnpm-lock.yaml", "+  left-pad@1.3.0:"),
      ]),
    ).toEqual([
      "Adds, removes or upgrades a dependency in `package.json`",
      "Changes dependencies: `pnpm-lock.yaml`",
    ]);
  });

  it.each([
    "alter table public.foods drop column notes;",
    "ALTER TABLE public.foods RENAME TO food;",
    "delete from public.entries where quantity = 0;",
    "create policy everyone_reads on public.foods for select using (true);",
    "alter table public.foods disable row level security;",
  ])("flags a risky migration: %s", (sql) => {
    const [reason] = humanReviewReasons([
      file("supabase/migrations/20261108000000_x.sql", `+${sql}`, "added"),
    ]);
    expect(reason).toMatch(/^Migration is irreversible or changes RLS/);
  });

  it("ignores risky words in SQL comments", () => {
    expect(
      humanReviewReasons([
        file(
          "supabase/migrations/20261108000000_x.sql",
          "+-- we never drop data here\n+create table public.x (id int);",
          "added",
        ),
      ]),
    ).toEqual([]);
  });

  it("flags edits to a committed migration", () => {
    expect(
      humanReviewReasons([
        file("supabase/migrations/20261101000000_x.sql", "+select 1;"),
      ]),
    ).toEqual([
      "Edits a committed migration: `supabase/migrations/20261101000000_x.sql`",
    ]);
  });

  it("flags a migration whose diff GitHub omitted", () => {
    expect(
      humanReviewReasons([
        file("supabase/migrations/20261108000000_x.sql", undefined, "added"),
      ]),
    ).toHaveLength(1);
  });

  it("flags new environment variables, but not in tests", () => {
    expect(
      humanReviewReasons([
        file("src/app/api/x/route.ts", "+const key = process.env.NEW_API_KEY;"),
        file("src/lib/x.test.ts", "+process.env.TZ = 'UTC';"),
        file(".env.example", "+NEW_API_KEY="),
      ]),
    ).toEqual([
      "Reads an environment variable: `src/app/api/x/route.ts`",
      "Changes the environment variables in `.env.example`",
    ]);
  });

  it("flags risk conditions the author ticked", () => {
    expect(
      humanReviewReasons(
        [],
        "Refs #5\n\n## Risk assessment\n\n- [x] Touches sign-in\n- [ ] Irreversible",
      ),
    ).toEqual(["The author ticked a risk condition: Touches sign-in"]);
  });
});

describe("tickedRiskConditions", () => {
  it("reads only the Risk assessment section", () => {
    const body = [
      "## How it was tested",
      "- [x] Ran the e2e tests",
      "## Risk assessment",
      "- [X] Adds a third-party integration",
      "- [ ] Irreversible",
      "## Notes",
      "- [x] Unrelated",
    ].join("\n");
    expect(tickedRiskConditions(body)).toEqual([
      "Adds a third-party integration",
    ]);
  });
});
