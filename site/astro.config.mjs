import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://overture.mov",
  base: "/",
  output: "static",
  integrations: [sitemap()],
});
