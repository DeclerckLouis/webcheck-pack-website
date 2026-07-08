// Screenshot a page for visual verification.
//
// Prereqs: `./scripts/setup.sh` (installs Playwright) and a running server,
//   e.g. `npm run build && npm run preview`  (serves http://localhost:4321).
//
// Usage:
//   node scripts/screenshot.mjs <url> <outfile.png> [width]
//   node scripts/screenshot.mjs http://localhost:4321/diensten /tmp/diensten.png 1280
//
// Default width is 1280 (desktop). Use e.g. 390 for a mobile viewport.
import { chromium } from "playwright";

const [url, out, width = "1280"] = process.argv.slice(2);
if (!url || !out) {
  console.error("usage: node scripts/screenshot.mjs <url> <outfile.png> [width]");
  process.exit(1);
}

// Prefer the environment's cached Chromium when present (sandboxes that block
// the Playwright CDN ship one under $PLAYWRIGHT_BROWSERS_PATH); otherwise fall
// back to Playwright's normal browser resolution.
const launchOpts = {};
if (process.env.PW_CHROMIUM_PATH) {
  launchOpts.executablePath = process.env.PW_CHROMIUM_PATH;
}

const browser = await chromium.launch(launchOpts);
try {
  const page = await browser.newPage({
    viewport: { width: Number(width), height: 900 },
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({ path: out, fullPage: true });
  console.log(`saved ${out} (${width}px) from ${url}`);
} finally {
  await browser.close();
}
