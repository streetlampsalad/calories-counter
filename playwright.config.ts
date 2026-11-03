import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  // Every current User is on Android, so the phone is the primary target.
  projects: [{ name: "android", use: { ...devices["Pixel 7"] } }],
  webServer: {
    // Runs the production build; `pnpm build` must have run first (validate does this).
    command: `pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
