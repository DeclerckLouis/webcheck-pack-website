// Generate a 1200x630 branded OG/social image for a blog article.
//
// Usage:
//   node scripts/make-og.mjs "Article title" public/images/blog/slug.png ["Kicker"]
//
// Renders a branded card (Packetflow blue/orange on cream) and writes a PNG
// clipped to exactly 1200x630. Reusable per article so each post gets its own
// share image without a design tool.
import { chromium } from "playwright";

const [title, out, kicker = "Blog"] = process.argv.slice(2);
if (!title || !out) {
  console.error('usage: node scripts/make-og.mjs "Title" out.png ["Kicker"]');
  process.exit(1);
}

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #f5f1ea;
    color: #1a1815;
    position: relative;
  }
  .accent { position: absolute; top: 0; left: 0; right: 0; height: 14px;
    background: linear-gradient(90deg, #0a4daa 0%, #0a4daa 62%, #f37f21 62%, #f37f21 100%); }
  .frame { position: absolute; inset: 14px 0 0; padding: 72px 84px;
    display: flex; flex-direction: column; height: calc(630px - 14px); }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand .dot { width: 16px; height: 16px; border-radius: 50%; background: #f37f21; }
  .brand .name { font-size: 30px; font-weight: 700; color: #0a4daa; letter-spacing: -0.01em; }
  .kicker { margin-top: 64px; font-size: 22px; font-weight: 700; letter-spacing: 0.14em;
    text-transform: uppercase; color: #c2410c; }
  h1 { margin-top: 22px; font-size: 64px; line-height: 1.08; font-weight: 800;
    letter-spacing: -0.02em; max-width: 18ch; color: #1a1815; }
  .foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between;
    font-size: 24px; color: #6b6359; }
  .foot .rule { width: 72px; height: 4px; background: #f37f21; }
  .foot .url { font-weight: 600; color: #1a1815; }
</style></head><body>
  <div class="accent"></div>
  <div class="frame">
    <div class="brand"><span class="dot"></span><span class="name">Packetflow</span></div>
    <div class="kicker">${esc(kicker)}</div>
    <h1>${esc(title)}</h1>
    <div class="foot"><span class="rule"></span><span class="url">packetflow.be</span></div>
  </div>
</body></html>`;

const launchOpts = {};
if (process.env.PW_CHROMIUM_PATH) {
  launchOpts.executablePath = process.env.PW_CHROMIUM_PATH;
}

const browser = await chromium.launch(launchOpts);
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log(`saved ${out}`);
} finally {
  await browser.close();
}
