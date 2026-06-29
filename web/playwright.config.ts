import { defineConfig, devices } from "@playwright/test";

// Headless harness for the emulator: Playwright boots the Vite dev server, loads
// the page, and runs the visual/smoke tests in tests/. Doubles as the Phase 3
// UX visual-regression harness. Run: pnpm -C web exec playwright test
const PORT = 5180;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts", // *.test.ts are vitest (Node) integration tests — not Playwright's
  outputDir: "./test-results",
  fullyParallel: true,
  // Spread the per-scene manual-accuracy tests across more cores. Percentage so it
  // scales with the machine (e.g. ~12 workers on a 16-core M3 Max → ~2 waves) and
  // dials itself down on smaller boxes / CI. Drop this if assertions flake under
  // load — the driver uses time-based settles, so very high contention can race.
  workers: "75%",
  // list: live progress in the terminal. html: a clickable failure report with a
  // side-by-side expected/actual/diff slider for the visual snapshots — far easier
  // than hunting for PNGs under test-results/. open:"never" keeps it from hijacking
  // the terminal on every run; open it with `mise run screenshot-report`.
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1100, height: 820 },
  },
  webServer: {
    command: `pnpm dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
