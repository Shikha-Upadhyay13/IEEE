// Regenerates public/og-image.png (1200×630), the link-preview image.
// Usage (from app/): node scripts/render-og-image.mjs
// Set E2E_BROWSER_CHANNEL=msedge|chrome to use an installed browser.
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../public/og-image.png", import.meta.url));

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,600&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: #f3efe6; font-family: Inter, sans-serif; color: #1c1917;
         display: flex; align-items: center; padding: 0 72px; gap: 56px; overflow: hidden; }
  .copy { flex: 1; }
  .brand { display: flex; align-items: center; gap: 12px; font-weight: 600; font-size: 22px; margin-bottom: 36px; }
  .mark { width: 40px; height: 40px; border-radius: 8px; background: #184a6b; color: #f8f4ec; display: grid;
          place-items: center; font-family: "Source Serif 4", serif; font-size: 22px; }
  h1 { font-family: "Source Serif 4", serif; font-weight: 600; font-size: 60px; line-height: 1.08; letter-spacing: -0.02em; }
  p { margin-top: 24px; font-size: 24px; line-height: 1.45; color: #6f675e; max-width: 560px; }
  .paper { width: 380px; height: 500px; background: #fff; border: 1px solid #e2dbd0; border-radius: 6px;
           box-shadow: 0 18px 40px rgba(24,74,107,.14); padding: 30px 28px; transform: rotate(2deg); }
  .t { height: 12px; background: #1c1917; margin: 0 auto 10px; width: 78%; border-radius: 2px; }
  .a { height: 7px; background: #a8a096; margin: 0 auto 6px; width: 46%; border-radius: 2px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 22px; }
  .h { height: 8px; width: 60%; background: #184a6b; margin: 10px 0 8px; border-radius: 2px; }
  .l { height: 5px; background: #d6cfc4; margin-bottom: 6px; border-radius: 2px; }
  .fig { height: 70px; border: 1px solid #e2dbd0; background: #f7f4ee; margin: 8px 0; border-radius: 2px; }
</style></head>
<body>
  <div class="copy">
    <div class="brand"><div class="mark">I</div>IEEE Paper Builder</div>
    <h1>Write the paper.<br>The IEEE formatting<br>is already done.</h1>
    <p>Two columns, numbered figures and IEEE-style citations — live, with no LaTeX.</p>
  </div>
  <div class="paper">
    <div class="t"></div><div class="t" style="width:52%"></div>
    <div class="a"></div><div class="a" style="width:34%"></div>
    <div class="cols">
      ${[0, 1]
        .map(
          () => `<div><div class="h"></div>${'<div class="l"></div>'.repeat(7)}<div class="fig"></div>${'<div class="l"></div>'.repeat(6)}<div class="h"></div>${'<div class="l"></div>'.repeat(8)}</div>`
        )
        .join("")}
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: out });
await browser.close();
console.log(`Wrote ${out}`);
