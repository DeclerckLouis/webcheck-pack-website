// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// SITE_URL / BASE_PATH are injected by CI (see .github/workflows/deploy.yml).
// Cloudflare Pages (production and previews) serves at the domain root, so
// BASE_PATH is always "/"; locally these are unset and fall back to defaults.
const SITE_URL = process.env.SITE_URL || "https://scan.packetflow.be";
const BASE_PATH = process.env.BASE_PATH || "/";

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  // Static-by-default: marketing pages are prerendered; the /api routes opt out
  // with `export const prerender = false`, so the Cloudflare adapter compiles
  // them into dist/_worker.js (Pages Functions) while pages stay static.
  output: "static",
  adapter: cloudflare({
    platformProxy: { enabled: true }, // local KV/bindings via `astro dev`
    // Astro sessions are unused here; point the session store at the existing
    // CACHE binding so the deploy needs no extra KV namespace and never emits an
    // "Invalid binding SESSION" error. Nothing is written — no code uses sessions.
    sessionKVBindingName: "CACHE",
  }),
  vite: {
    // Cast: @tailwindcss/vite and Astro resolve slightly different Vite type
    // versions, which only clash at the type level — the plugin runs fine.
    plugins: [/** @type {any} */ (tailwindcss())],
  },
});
