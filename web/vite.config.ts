import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// The tool's ui.js imports by absolute on-device paths. Remap them to dev
// sources so the emulator loads the REAL UI (with HMR) — no bundle_ui.py step.
const TOOL_UI = resolve(here, "../overture-ui/ui");
// Behavior-tier wasm engine (gitignored build artifact from `mise run wasm`).
const SEQ8_WASM = resolve(here, "../overture-ui/dist/wasm/seq8.mjs");

// Schwung shared/* modules: prefer the overture `schwung` submodule (future),
// fall back to the sibling dev checkout. Override with SCHWUNG_SRC=/abs/path.
const SCHWUNG_SHARED =
  process.env.SCHWUNG_SRC ||
  [resolve(here, "../schwung/src/shared"), resolve(here, "../../schwung/src/shared")].find(existsSync) ||
  resolve(here, "../../schwung/src/shared");

const ON_DEVICE_SHARED = "/data/UserData/schwung/shared/";
const ON_DEVICE_OVERTURE = "/data/UserData/schwung/modules/tools/overture/";

/** Rewrite the tool's absolute on-device import paths to local dev sources. */
function moveDeviceImports() {
  return {
    name: "move-device-imports",
    enforce: "pre" as const,
    resolveId(source: string) {
      if (source.startsWith(ON_DEVICE_SHARED))
        return resolve(SCHWUNG_SHARED, source.slice(ON_DEVICE_SHARED.length));
      if (source.startsWith(ON_DEVICE_OVERTURE))
        return resolve(TOOL_UI, source.slice(ON_DEVICE_OVERTURE.length));
      return null;
    },
  };
}

export default defineConfig({
  root: here,
  define: {
    OVERTURE_DEBUG_LOG: "false",
  },
  // react() handles JSX + Fast Refresh; moveDeviceImports keeps enforce:"pre" so it
  // still wins on the tool's absolute on-device import specifiers.
  plugins: [react(), moveDeviceImports()],
  resolve: {
    alias: {
      "seq8-wasm": SEQ8_WASM,
      "@": resolve(here, "src"),
      "@overture-ui": TOOL_UI,
    },
  },
  server: {
    fs: {
      // Allow serving the dev sources that live outside web/.
      allow: [here, TOOL_UI, SCHWUNG_SHARED, resolve(here, "..")],
    },
  },
});
