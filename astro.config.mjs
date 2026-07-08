// @ts-check
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// Strip HTML comments from the prerendered output so source comments (e.g. dev
// notes) never ship to visitors. Only touches emitted .html files; inline JS/CSS
// and JSON-LD contain no `<!-- -->`, so the plain regex is safe here.
function stripHtmlComments() {
  return {
    name: "strip-html-comments",
    hooks: {
      /** @param {{ dir: URL }} ctx */
      "astro:build:done": async ({ dir }) => {
        const root = fileURLToPath(dir);
        /** @param {string} d */
        const walk = async (d) => {
          for (const entry of await readdir(d, { withFileTypes: true })) {
            const p = path.join(d, entry.name);
            if (entry.isDirectory()) await walk(p);
            else if (entry.name.endsWith(".html")) {
              const html = await readFile(p, "utf8");
              const stripped = html.replace(/<!--[\s\S]*?-->/g, "");
              if (stripped !== html) await writeFile(p, stripped);
            }
          }
        };
        await walk(root);
      },
    },
  };
}

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
  integrations: [stripHtmlComments()],
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
