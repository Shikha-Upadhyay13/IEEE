// Fails the build when the JavaScript or CSS shipped to browsers grows past
// the budgets below, measured gzipped. Build with VITE_SENTRY_DSN and
// VITE_POSTHOG_KEY set (any value) so their lazily loaded chunks are counted.
// Usage: npm run build && node scripts/bundle-budget.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const ASSETS = join(resolve(import.meta.dirname, ".."), "dist", "assets");

// Raise a budget deliberately, in its own commit, when growth is expected.
// Measured on a build with Sentry and PostHog enabled (CI sets placeholder
// keys), since without them their lazily loaded chunks are left out.
const BUDGET_KB = {
  // What the first page load fetches: the entry script and everything index.html preloads.
  initialJs: 370,
  largestJsChunk: 415,
  totalJs: 1240,
  totalCss: 25,
};

const kb = (bytes) => Math.round(bytes / 102.4) / 10;
const gz = (file) => gzipSync(readFileSync(join(ASSETS, file))).length;

const files = readdirSync(ASSETS);
const js = files.filter((f) => f.endsWith(".js"));
const css = files.filter((f) => f.endsWith(".css"));
const html = readFileSync(join(ASSETS, "..", "index.html"), "utf8");
const initial = js.filter((f) => html.includes(`/assets/${f}`));

const sizes = Object.fromEntries(js.map((f) => [f, gz(f)]));
const largest = js.reduce((a, b) => (sizes[a] >= sizes[b] ? a : b));
const measured = {
  initialJs: initial.reduce((sum, f) => sum + sizes[f], 0),
  largestJsChunk: sizes[largest],
  totalJs: js.reduce((sum, f) => sum + sizes[f], 0),
  totalCss: css.reduce((sum, f) => sum + gz(f), 0),
};

let over = false;
for (const [name, bytes] of Object.entries(measured)) {
  const limit = BUDGET_KB[name];
  const ok = !limit || kb(bytes) <= limit;
  if (!ok) over = true;
  console.log(`${ok ? "ok  " : "OVER"} ${name.padEnd(15)} ${String(kb(bytes)).padStart(7)} kB gzipped (budget ${limit || "unset"})`);
}
console.log(`largest chunk: ${largest}; initial files: ${initial.join(", ")}`);
if (over) process.exit(1);
