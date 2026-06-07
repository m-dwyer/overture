import { mergeConfig, defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Headless integration tests: the real tool ui.js + real seq8-wasm run in Node
// against recorder sinks. Reuses the Vite import-remap plugin + seq8-wasm alias
// (so /data/.../*.mjs resolve exactly as in the browser). Playwright *.spec.ts
// (visual/E2E) are excluded — those run via `playwright test`.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // seq8.mjs is an emscripten artifact — let Node load it natively, not via the
    // Vite transform pipeline.
    server: { deps: { external: [/seq8\.mjs$/] } },
  },
}));
