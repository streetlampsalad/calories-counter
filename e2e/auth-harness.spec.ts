import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { authFile, TEST_USERS, type TestUserName } from "./support/auth";

// Proves the harness itself: each seeded User gets a stored session for their own account.
for (const name of Object.keys(TEST_USERS) as TestUserName[]) {
  test(`${name} has a stored session for their own account`, async () => {
    const state = JSON.parse(await readFile(authFile(name), "utf8"));
    const cookie = state.cookies.find((c: { name: string }) =>
      c.name.endsWith("-auth-token"),
    );
    expect(cookie, "Supabase auth cookie").toBeTruthy();

    const encoded = cookie.value.replace(/^base64-/, "");
    const session = JSON.parse(Buffer.from(encoded, "base64url").toString());
    expect(session.user.email).toBe(TEST_USERS[name].email);
    expect(session.user.id).toBe(TEST_USERS[name].id);
  });
}
