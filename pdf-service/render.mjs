import { chromium } from "playwright";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

/**
 * Navigates headless Chromium to the print route for one document and
 * returns the exported PDF as a Buffer. Shared by the CLI script (export.mjs,
 * for local testing) and the HTTP server (server.mjs, for the browser's
 * Export button) — one rendering call site, not two.
 */
export async function renderPdf({ documentId, token }) {
  const url = token
    ? `${FRONTEND_URL}/print/${documentId}?token=${token}`
    : `${FRONTEND_URL}/print/${documentId}`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });

    // Wait for the actual render-complete signal (set by PagedPreview's
    // onReady, via PrintView) rather than a fixed timeout — pagination time
    // scales with document length, so a fixed sleep would be flaky.
    await page.waitForSelector('body[data-render-ready="true"]', { timeout: 30_000 });

    await page.emulateMedia({ media: "print" });

    // Zero Chromium-applied margin: ieee-template.css's @page rule already
    // encodes the true IEEE margins (0.75in/1in/0.625in) — a second margin
    // here would double up on top of that.
    return await page.pdf({
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
  } finally {
    await browser.close();
  }
}
