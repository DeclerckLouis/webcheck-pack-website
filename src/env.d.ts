/// <reference types="astro/client" />

/** Cloudflare bindings available at `Astro.locals.runtime.env` (see wrangler.toml). */
interface CloudflareEnv {
  CACHE: KVNamespace;
  RATE: KVNamespace;
  PUBLIC_ODOO_URL?: string;
  PUBLIC_TURNSTILE_SITEKEY?: string;
  TURNSTILE_SECRET?: string;
}

type Runtime = import("@astrojs/cloudflare").Runtime<CloudflareEnv>;

declare namespace App {
  interface Locals extends Runtime {}
}
