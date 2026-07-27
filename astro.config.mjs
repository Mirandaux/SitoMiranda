// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://mirandagiaccon.it",
  trailingSlash: "never",
  output: "server",
  adapter: vercel(),
  integrations: [sitemap()],
});
