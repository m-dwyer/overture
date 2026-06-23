import { defineConfig } from "astro/config";

const repositoryBase = process.env.GITHUB_PAGES === "true" ? "/overture/" : "/";

export default defineConfig({
  site: "https://m-dwyer.github.io",
  base: repositoryBase,
  output: "static",
});
