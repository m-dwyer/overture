import { mergeConfig, defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import viteConfig from "./vite.config";

const here = dirname(fileURLToPath(import.meta.url));

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
    coverage: {
      provider: "v8",
      // This tier runs the REAL tool UI (ui.js + ui/*.mjs, remapped from their
      // on-device absolute paths to ../overture-ui/ui). Measure that source tree —
      // this is the "did the real engine path execute it" signal that the
      // mock-deps unit tier can't give. all:false: count only what the harness
      // actually loads (no synthetic 0% rows for the emulator/harness scaffolding).
      // The tool UI lives OUTSIDE web/ root; the v8 provider drops covered files
      // outside root unless allowExternal is set. Include it by absolute path.
      allowExternal: true,
      include: [resolve(here, "../overture-ui/ui") + "/**/*.{mjs,js}"],
      all: false,
      reporter: ["text", "json-summary", "json", "html"],
      reportsDirectory: "coverage",
    },
  },
}));
