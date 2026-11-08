import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { authFile } from "./e2e/support/auth";

// Playwright does not read .env.local itself; `pnpm env:local` writes it for the local stack.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3000;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Tests run signed in as ada; use test.use({ storageState: ... }) to change that.
    storageState: authFile("ada"),
    // The app's service worker would otherwise take over pages mid-test. Requests made while it is
    // activating are invisible to page.route and page.waitForRequest, which on a slow CI runner
    // made the photo upload test miss its request. Only installable.spec.ts, which tests the
    // worker, turns it back on.
    serviceWorkers: "block",
  },
  // Every current User is on Android, so the phone is the primary target.
  projects: [{ name: "android", use: { ...devices["Pixel 7"] } }],
  webServer: {
    // Runs the production build; `pnpm build` must have run first (validate does this).
    command: `pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // Photo import and product search use stand-ins, so tests never call Google or Open Food Facts.
    env: {
      NOTES_READER: "fake",
      CALORIE_GUESSER: "fake",
      OFF_SOURCE: "fixture",
      // Feature Requests create no real GitHub Issues in tests (spec 124).
      FEATURE_ISSUES: "fake",
      // e2e/feature-requests.spec.ts posts syncs with this; production sets its own.
      FEATURE_REQUESTS_SYNC_SECRET: "e2e-feature-requests-sync-secret",
    },
    timeout: 60_000,
  },
});
