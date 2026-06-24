import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { access, copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { join, sep } from "node:path";
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
const MOVEFORGE_ROOT = process.env.MOVEFORGE_ROOT || resolve(here, "../../../moveforge");

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
  base: process.env.OVERTURE_WEB_BASE || (process.env.NODE_ENV === "production" ? "./" : "/"),
  root: here,
  define: {
    OVERTURE_DEBUG_LOG: "false",
  },
  // react() handles JSX + Fast Refresh; moveDeviceImports keeps enforce:"pre" so it
  // still wins on the tool's absolute on-device import specifiers.
  plugins: [react(), moveDeviceImports(), serveMoveforgeAssets(), copyMoveforgeAssets()],
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

function serveMoveforgeAssets(): Plugin {
  const modulesDir = resolve(MOVEFORGE_ROOT, "src/modules");
  const wasmDir = resolve(MOVEFORGE_ROOT, "web/wasm");
  const allowedModules = modulesDir + sep;
  const allowedWasm = wasmDir + sep;
  return {
    name: "overture-serve-moveforge-assets",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        const url = req.url.split("?")[0];
        const modulesMatch = url.match(/^\/modules\/(.+)$/);
        const wasmMatch = url.match(/^\/wasm\/([^/]+\.wasm)$/);
        const root = modulesMatch ? modulesDir : wasmMatch ? wasmDir : null;
        const allowedPrefix = modulesMatch ? allowedModules : allowedWasm;
        const rel = modulesMatch?.[1] ?? wasmMatch?.[1];
        if (!root || !rel) return next();
        const filePath = resolve(root, rel);
        if (!filePath.startsWith(allowedPrefix)) {
          res.statusCode = 403;
          res.end("forbidden");
          return;
        }
        try {
          const data = await readFile(filePath);
          res.setHeader("Content-Type", contentTypeFor(filePath));
          res.end(data);
        } catch {
          res.statusCode = 404;
          res.end("not found");
        }
      });
    },
  };
}

function copyMoveforgeAssets(): Plugin {
  let outDir = resolve(here, "dist");
  return {
    name: "overture-copy-moveforge-assets",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const missing: string[] = [];
      const wasmSrc = resolve(MOVEFORGE_ROOT, "web/wasm");
      const wasmOut = join(outDir, "wasm");
      await mkdir(wasmOut, { recursive: true });
      let wasmCount = 0;
      try {
        for (const entry of await readdir(wasmSrc, { withFileTypes: true })) {
          if (!entry.isFile() || !entry.name.endsWith(".wasm")) continue;
          await copyFile(join(wasmSrc, entry.name), join(wasmOut, entry.name));
          wasmCount++;
        }
      } catch (error) {
        missing.push(`Moveforge WASM directory ${wasmSrc}: ${(error as Error).message}`);
      }
      if (wasmCount === 0) missing.push("copied 0 Moveforge .wasm files");

      const modulesSrc = resolve(MOVEFORGE_ROOT, "src/modules");
      const modulesOut = join(outDir, "modules");
      await mkdir(modulesOut, { recursive: true });
      let moduleIds: string[] = [];
      try {
        const indexBytes = await readFile(join(modulesSrc, "index.json"), "utf8");
        await copyFile(join(modulesSrc, "index.json"), join(modulesOut, "index.json"));
        const index = JSON.parse(indexBytes) as { modules?: Array<{ id?: unknown }> };
        moduleIds = (index.modules ?? []).map((entry) => String(entry.id ?? "")).filter(Boolean);
      } catch (error) {
        missing.push(`Moveforge module index ${join(modulesSrc, "index.json")}: ${(error as Error).message}`);
      }
      try {
        for (const entry of await readdir(modulesSrc, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
          const srcDir = join(modulesSrc, entry.name);
          const dstDir = join(modulesOut, entry.name);
          await mkdir(dstDir, { recursive: true });
          for (const file of ["module.json", "presets.json", "metadata.json"]) {
            await copyFile(join(srcDir, file), join(dstDir, file)).catch(() => {});
          }
        }
      } catch (error) {
        missing.push(`Moveforge module metadata under ${modulesSrc}: ${(error as Error).message}`);
      }
      for (const moduleId of moduleIds) {
        await access(join(modulesOut, moduleId, "module.json")).catch(() => {
          missing.push(`missing copied module metadata for ${moduleId}`);
        });
        await access(join(wasmOut, `${moduleId}.wasm`)).catch(() => {
          missing.push(`missing copied WASM for ${moduleId}`);
        });
      }
      if (missing.length > 0) {
        this.error(`Moveforge assets are incomplete. Set MOVEFORGE_ROOT to a checkout with built web WASM.\n- ${missing.join("\n- ")}`);
      }
    },
  };
}

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop() ?? "";
  if (ext === "json") return "application/json";
  if (ext === "wasm") return "application/wasm";
  if (ext === "js") return "text/javascript";
  return "application/octet-stream";
}
