// @ts-check
import { defineConfig } from "astro/config";
import { holidaysPlugin } from "./plugins/holidays.ts";

// GitHub Pages serves a project site from /<repo>/, so the deploy workflow passes
// the real origin and base path in. Locally both fall back to the root.
export default defineConfig({
  site: process.env.SITE_URL || "https://cloudalgo.github.io",
  base: process.env.BASE_PATH || "/",
  trailingSlash: "ignore",
  vite: { plugins: [holidaysPlugin()] },
});
