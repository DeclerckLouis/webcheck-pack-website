// Generate the 1200×630 social share card (public/images/og-image.png).
//
// Renders a branded card with Playwright and writes a PNG. Re-run after
// changing the copy/brand below. Reproducible so the card never drifts back to
// the old 3 KB placeholder.
//
// Prereqs: Playwright (installed by ./scripts/setup.sh).
// Usage:   node scripts/og-image.mjs [outfile.png]
import { chromium } from "playwright";
import path from "node:path";

const out =
  process.argv[2] ?? path.join(process.cwd(), "public/images/og-image.png");

// Brand tokens, mirrored from src/styles/global.css so the card matches the site.
const html = `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Lora:ital,wght@1,500;1,600&display=swap" rel="stylesheet" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1200px; height: 630px; }
      body {
        position: relative;
        background: #f5f1ea;
        font-family: "Poppins", sans-serif;
        color: #1a1815;
        padding: 72px 80px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
      }
      /* Soft brand wash bottom-right */
      .glow {
        position: absolute;
        right: -160px;
        bottom: -200px;
        width: 620px;
        height: 620px;
        border-radius: 50%;
        background: radial-gradient(circle at center, rgba(243,127,33,0.18), rgba(243,127,33,0) 70%);
      }
      .brand { display: flex; align-items: center; gap: 18px; }
      .brand__name { font-size: 38px; font-weight: 600; letter-spacing: -0.01em; }
      .rule { width: 88px; height: 5px; background: #f37f21; border-radius: 999px; margin: 0 0 28px; }
      h1 {
        font-size: 76px;
        line-height: 1.08;
        font-weight: 600;
        letter-spacing: -0.02em;
        max-width: 19ch;
      }
      h1 .hi { font-family: "Lora", serif; font-style: italic; font-weight: 500; color: #0a4daa; }
      .sub {
        margin-top: 30px;
        font-size: 30px;
        font-weight: 500;
        color: #4a453d;
      }
      .foot { display: flex; align-items: center; justify-content: space-between; }
      .pillars { font-size: 26px; font-weight: 500; color: #c2410c; letter-spacing: 0.01em; }
      .domain { font-size: 26px; font-weight: 600; color: #0a4daa; }
    </style>
  </head>
  <body>
    <div class="glow"></div>
    <div class="brand">
      <svg viewBox="10 10 30 30" width="56" height="56" aria-hidden="true">
        <path d="M 10 10 L 10 40 L 25 40 L 25 25 C 25 16.7 31.7 10 40 10 L 10 10 Z" fill="#0A4DAA" />
        <path d="M 40 40 L 25 40 L 25 25 C 25 33.3 31.7 40 40 40 Z" fill="#F37F21" />
      </svg>
      <span class="brand__name">Packetflow</span>
    </div>

    <div>
      <div class="rule"></div>
      <h1>Hoe gezond is <span class="hi">uw domein</span>?</h1>
      <p class="sub">Gratis domeinscan — SPF, DMARC, DKIM, DNSSEC &amp; meer</p>
    </div>

    <div class="foot">
      <span class="pillars">Score van 0 tot 100 · in enkele seconden</span>
      <span class="domain">scan.packetflow.be</span>
    </div>
  </body>
</html>`;

const launchOpts = {};
if (process.env.PW_CHROMIUM_PATH) {
  launchOpts.executablePath = process.env.PW_CHROMIUM_PATH;
}

const browser = await chromium.launch(launchOpts);
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log(`saved ${out} (1200×630)`);
} finally {
  await browser.close();
}
