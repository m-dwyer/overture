import { mergeConfig, defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Headless integration tests: the active tool ui.js runs in Node against
// recorder sinks. Reuses the Vite import-remap plugin so /data/... imports
// resolve exactly as in the browser. Playwright *.spec.ts visual/E2E tests run
// via `playwright test`.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text", "json-summary", "html"],
    },
  },
}));
