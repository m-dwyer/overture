import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { cp, access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, sep } from "node:path";

export default defineConfig({
  site: "https://overture.mov",
  base: "/",
  output: "static",
  integrations: [sitemap()],
  vite: {
    plugins: [serveWebEmulator(), copyWebEmulator()],
  },
});

function serveWebEmulator() {
  const webDist = resolve(import.meta.dirname, "../web/dist");
  const allowedPrefix = webDist + sep;
  return {
    name: "overture-serve-web-emulator",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        const url = req.url.split("?")[0];
        if (url !== "/emulator" && url !== "/emulator/" && !url.startsWith("/emulator/")) return next();

        const rel = url === "/emulator" || url === "/emulator/"
          ? "index.html"
          : decodeURIComponent(url.slice("/emulator/".length));
        const filePath = resolve(webDist, rel);
        if (!filePath.startsWith(allowedPrefix) && filePath !== webDist) {
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
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Overture emulator assets are not built. Run `mise web-build`, then reload /try/.");
        }
      });
    },
  };
}

function copyWebEmulator() {
  const webDist = resolve(import.meta.dirname, "../web/dist");
  let siteDist = resolve(import.meta.dirname, "dist");
  return {
    name: "overture-copy-web-emulator",
    apply: "build",
    configResolved(config) {
      siteDist = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      try {
        await access(webDist, constants.R_OK);
      } catch {
        this.error("web/dist not found; run `pnpm -C ../web build` before building the site to publish /emulator/");
        return;
      }
      await cp(webDist, resolve(siteDist, "emulator"), { recursive: true });
    },
  };
}

function contentTypeFor(path) {
  const ext = path.split(".").pop() ?? "";
  if (ext === "html") return "text/html; charset=utf-8";
  if (ext === "css") return "text/css; charset=utf-8";
  if (ext === "js") return "text/javascript; charset=utf-8";
  if (ext === "json") return "application/json; charset=utf-8";
  if (ext === "wasm") return "application/wasm";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "png") return "image/png";
  return "application/octet-stream";
}
