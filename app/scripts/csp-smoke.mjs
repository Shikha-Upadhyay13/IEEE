// Serves dist/ with the report-only policy from vercel.json enforced, opens
// the main pages in Chromium and fails on any Content-Security-Policy violation.
// Usage: npm run build && node scripts/csp-smoke.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const PAGES = ["/", "/login", "/reset-password", "/guides", "/templates", "/terms", "/privacy", "/unsubscribe", "/no-such-page"];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".txt": "text/plain", ".xml": "application/xml" };

const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8"));
const reportOnly = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy-Report-Only").value;
const policy = reportOnly.replace(/;\s*report-uri [^;]+/, "").replace(/;\s*report-to [^;]+/, "");

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = join(DIST, path);
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Content-Security-Policy": policy });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ channel: process.env.CSP_SMOKE_CHANNEL || undefined });
const violations = [];
try {
  for (const path of PAGES) {
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) violations.push(`${path}: ${msg.text()}`);
    });
    await page.goto(origin + path, { waitUntil: "networkidle" });
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log(`No CSP violations on ${PAGES.length} pages.`);
