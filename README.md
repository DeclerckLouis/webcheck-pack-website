# Domeinscan — `scan.packetflow.be`

A public, lead-generating **domain health checker** for Packetflow. A visitor
types a domain and gets a **0–100 score** with a red/orange/green traffic light
across seven DNS/email/security categories. The score + traffic light are a free
teaser; the full report (what's wrong + what it means) is unlocked with an email
capture that feeds Packetflow's existing Odoo CRM.

Think "mxtoolbox for someone who isn't a sysadmin" — the target user is a small
business owner (dentist, pharmacist, electrician…), and it doubles as a live
"let me check your domain right now" prop during in-person sales.

> Product name **Domeinscan**, hosted at **scan.packetflow.be** (greenfield —
> the name/subdomain were open; "scan" is short, Dutch-friendly and leaves room
> for the future *Beveiliging* scan mode).

## Stack

- **Astro 5** (static pages) + **Tailwind v4** — consistent with the main
  Packetflow site.
- **Cloudflare Pages + Pages Functions** via `@astrojs/cloudflare`. The two
  `/api/*` routes run at the edge; everything else is prerendered static.
- **Cloudflare KV** for the result cache and the per-IP rate limiter.
- DNS over **DNS-over-HTTPS** (Cloudflare JSON API); WHOIS-equivalent data over
  **RDAP**. No shells, no raw sockets — all `fetch()` (required on Workers).

## Local development

```bash
npm install
npm run dev        # http://localhost:4321 — KV works locally via platformProxy
npm run build      # production build into dist/
npm run cf:dev     # build + `wrangler pages dev dist` (closest to production)
npm test           # vitest — unit tests for the ported parsing/scoring logic
```

Local secrets (optional) go in `.dev.vars` (git-ignored) — see `.dev.vars.example`.

## Project layout

```
src/
  config/scoring.ts     ← ALL tunables: weights, thresholds, RBLs, DKIM selectors, TTLs
  lib/
    normalize.ts        ← URL/host → root domain (port of the reference script)
    doh.ts  rdap.ts      ← DNS-over-HTTPS + RDAP clients
    parse.ts            ← SPF lookup count, DMARC parse, MX classify (unit-tested)
    checks.ts           ← the 7 category checks
    scoring.ts check.ts ← traffic-light mapping + orchestrator
    server/             ← KV cache, rate limit, Turnstile, Odoo forward (edge-only)
  pages/
    index.astro         ← the UI shell
    404.astro
    api/check.ts        ← POST: run/serve-cached a scan, returns the teaser + checkId
    api/unlock.ts       ← POST: email gate → returns full report + forwards lead to Odoo
  scripts/app.ts        ← client state machine (idle → summary → gate → report)
tests/                  ← vitest
```

## Tuning (no code review needed)

Everything Louis is likely to tweak lives in **`src/config/scoring.ts`**:

- **Category weights** (SPF 20, DMARC 20, DKIM 15, DNSSEC 15, MX 10, Blacklist
  15, Domain 5 — sum = 100).
- **`COLOR_THRESHOLDS`** — green ≥ 80, orange ≥ 50 (placeholder — see open Q2).
- **`CACHE_TTL_SECONDS`** (12h), **`RATE_LIMIT`** (20/hour/IP).
- **`DKIM_SELECTORS`**, **`RBLS`**, **`DOMAIN_EXPIRY_WARNING_DAYS`**.

The config is keyed by *mode* (`general`) so the future **security** scan
(subdomain enum, Shodan — brief §6b) drops in as a second profile, not a rewrite.
The UI already renders a disabled "Beveiliging · binnenkort" mode chip.

## Lead handling (Odoo) — reuses the main site's pipeline

`src/lib/server/odoo.ts` POSTs `multipart/form-data` to
`{PUBLIC_ODOO_URL}/website/form/crm.lead` — the **same** integration the main
site's contact form uses (see `odoo/README.md`). No separate lead table. Because
this runs server-side (a Function, not the browser), it reads the real response
and reports success/failure — no `no-cors` blindness.

Field mapping mirrors `odoo/README.md`; the scan context (domain + score +
timestamp) is appended to the `description` field. A failed lead is logged but
**does not** block the visitor's report.

## Deploy

One GitHub Actions workflow — `deploy.yml` — drives both environments on
Cloudflare Pages:

- **Production** — push to `main` → `wrangler pages deploy` to the Cloudflare
  Pages project `packetflow-scan` (serves `scan.packetflow.be`).
- **Previews** — every ready-for-review PR → an isolated preview deployment with
  its own `*.pages.dev` URL. Unlike a static host, previews **run the `/api/*`
  Functions**, so reviewers can test a real scan before merge.

**Owner setup status — all core steps done:**

1. ✅ Repo secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` added.
2. ✅ KV namespaces **CACHE** + **RATE** created and their ids wired into
   `wrangler.toml`; the deploy applies the bindings.
3. ✅ Pages project `packetflow-scan` — created automatically by the deploy step
   (`wrangler pages project create --production-branch=main`, idempotent).
4. ✅ **Custom domain `scan.packetflow.be`** — added on the Pages project and
   resolving to Cloudflare. It serves the **production** deployment, which is
   published on push to `main` (i.e. once this PR is merged); until then it
   returns Cloudflare's "Deployment Not Found".
5. *(Optional)* Turnstile — the two keys live in **different** places, and
   neither is a GitHub *repo* secret that the running app reads directly:
   - `PUBLIC_TURNSTILE_SITEKEY` is inlined into the browser bundle at **build
     time**, so it must be set in GitHub, not Cloudflare — a Cloudflare runtime
     var can't reach the prerendered page. It's public (it ships in the HTML), so
     add it as a **repository Variable** (Settings → Secrets and variables →
     Actions → *Variables* tab → New repository variable). The Build step reads
     `vars.PUBLIC_TURNSTILE_SITEKEY`.
   - `TURNSTILE_SECRET` is read by the Worker at **runtime**, so add it as an
     **encrypted variable in the Cloudflare Pages project** (Settings → Variables
     and Secrets). A GitHub repo secret never reaches the Worker.
   Leave both empty to keep Turnstile disabled. Set **both** to enable it —
   setting only the secret makes every scan fail verification.

## Known limitations (v1, by design)

- **Spamhaus over public DoH** is often refused — Spamhaus rate-limits large
  public resolvers (incl. Cloudflare 1.1.1.1). Blacklist results are best-effort;
  the UI says so. Real fix later: a Spamhaus DQS key.
- **DNSSEC** is judged by the resolver's `AD` (Authenticated Data) flag, not a
  hand-rolled DS/DNSKEY chain (brief-sanctioned simplification, brief §4).
- **DKIM** guesses common selectors only — a custom selector can show as missing
  even when configured. Surfaced explicitly in the UI (brief §3).
- **`normalizeDomain`** keeps the last two labels, so compound TLDs like
  `example.co.uk` normalize wrong. Correct for the `.be`/`.com`/`.nl` audience;
  a public-suffix list is the fix if that ever matters.

## Open questions for Louis (build ships with sensible defaults)

1. **Odoo integration** — ✅ resolved: reuses the `website/form/crm.lead` endpoint.
2. **Color thresholds** — placeholder 80/50 in `COLOR_THRESHOLDS`; confirm before launch.
3. **Copy** — the email-gate pitch and DKIM caveat are placeholders (marked in
   `index.astro` / `scoring.ts`); reword in your voice.
4. **Expiry data** — RDAP doesn't expose expiry for every TLD; we show "onbekend"
   rather than a wrong date. Confirm that's acceptable.
