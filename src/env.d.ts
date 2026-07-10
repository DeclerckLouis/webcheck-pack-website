/// <reference types="astro/client" />

/** Cloudflare bindings available at `Astro.locals.runtime.env` (see wrangler.toml). */
interface CloudflareEnv {
  CACHE: KVNamespace;
  RATE: KVNamespace;
  PUBLIC_ODOO_URL?: string;
  PUBLIC_TURNSTILE_SITEKEY?: string;
  TURNSTILE_SECRET?: string;
  /** Spamhaus Data Query Service key — lets RBL lookups work through DoH (brief §1). */
  SPAMHAUS_DQS_KEY?: string;
}

type Runtime = import("@astrojs/cloudflare").Runtime<CloudflareEnv>;

declare namespace App {
  interface Locals extends Runtime {}
}
