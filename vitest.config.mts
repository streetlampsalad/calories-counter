import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    setupFiles: ["./vitest.setup.ts"],
    clearMocks: true,
    // Starting jsdom costs most of a test file's time, so only the files that need a browser get
    // one. A *.test.ts file that needs one (a hook, localStorage) opts in with a first line of
    // `// @vitest-environment jsdom`; without it the test fails rather than passing untested.
    projects: [
      {
        extends: true,
        test: {
          name: "browser",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "src/**/*.test.ts",
            "e2e/support/**/*.test.ts",
            "scripts/**/*.test.mjs",
          ],
        },
      },
    ],
  },
});
