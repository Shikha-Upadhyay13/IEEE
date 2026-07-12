import { chromium } from "playwright";
import path from "node:path";

// Milestone 1 scope: no auth token, no per-document routing (see PrintView.tsx
// and ARCHITECTURE.md §5.3/§10) — this proves the render-to-PDF pipeline works
// end-to-end against the hardcoded sample paper. The auth/document-id handshake
// is deferred until Milestone 6, once documents are actually persisted.
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
const outputPath = path.resolve(process.argv[2] ?? "output.pdf");

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`${FRONTEND_URL}/print`, { waitUntil: "networkidle" });

  // Wait for the actual render-complete signal (set by PagedPreview's onReady,
  // via PrintView) rather than a fixed timeout — pagination time scales with
  // document length, so a fixed sleep would be flaky on longer papers.
  await page.waitForSelector('body[data-render-ready="true"]', { timeout: 30_000 });

  await page.emulateMedia({ media: "print" });

  // Zero Chromium-applied margin: ieee-template.css's @page rule already
  // encodes the true IEEE margins (0.75in/1in/0.625in). A second margin here
  // would double up on top of that.
  await page.pdf({
    path: outputPath,
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  console.log(`Exported PDF to ${outputPath}`);
} finally {
  await browser.close();
}
