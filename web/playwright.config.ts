import { defineConfig, devices } from "@playwright/test";

// Headless harness for the emulator: Playwright boots the Vite dev server, loads
// the page, and runs the visual/smoke tests in tests/. Doubles as the Phase 3
// UX visual-regression harness. Run: pnpm -C web exec playwright test
const PORT = 5180;

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1100, height: 820 },
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `pnpm dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
