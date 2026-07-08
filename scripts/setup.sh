#!/bin/bash
# Setup script for the Packetflow website dev/CI environment.
#
# Captures everything that had to be done by hand to get productive in a fresh
# container: install deps, and wire up Playwright + the cached Chromium so pages
# can be screenshotted for visual verification.
#
# Usage:  ./scripts/setup.sh
# Safe to run repeatedly (idempotent).
set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Project dependencies. `npm install` (not `npm ci`) reuses a cached
#    node_modules on repeat runs instead of reinstalling from scratch.
echo "==> npm install"
npm install --no-audit --no-fund

# 2. Visual-verification tooling (Playwright + Chromium).
#    Some sandboxes block cdn.playwright.dev but ship a cached Chromium under
#    $PLAYWRIGHT_BROWSERS_PATH. Playwright 1.56.x bundles build 1194 /
#    Chromium 141 — the cached revision — so installing it triggers NO browser
#    download; chromium.launch() finds the cached binary on its own.
#    Elsewhere (path unset), this installs Playwright and its browser normally.
echo "==> installing playwright@1.56"
if npm install --no-save --no-audit --no-fund playwright@1.56; then
  if [ -z "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
    # No pre-cached browser dir — download Chromium the normal way.
    npx playwright install chromium || \
      echo "warn: 'playwright install chromium' failed; visual checks unavailable"
  fi
else
  echo "warn: playwright install failed; visual checks unavailable"
fi

# 3. Smoke-test the build so we fail fast if the site doesn't compile.
echo "==> npm run build (smoke test)"
npm run build

echo "==> setup complete"
echo "    dev server:   npm run dev      (http://localhost:4321)"
echo "    screenshot:   node scripts/screenshot.mjs <url> <out.png> [width]"
