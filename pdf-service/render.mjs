import { chromium } from "playwright";
import { finalizePdf } from "./finalizePdf.mjs";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

/**
 * Navigates headless Chromium to the print route for one document and
 * returns the exported PDF as a Buffer. Shared by the CLI script (export.mjs,
 * for local testing) and the HTTP server (server.mjs, for the browser's
 * Export button) — one rendering call site, not two.
 */
export async function renderPdf({ documentId, token, signal }) {
  const base = `${FRONTEND_URL}/print/${encodeURIComponent(documentId)}`;
  const url = token ? `${base}?token=${encodeURIComponent(token)}` : base;

  const browser = await chromium.launch();
  // A timed-out render must not leave its Chromium process running.
  const closeOnAbort = () => browser.close().catch(() => {});
  signal?.addEventListener("abort", closeOnAbort, { once: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });

    // Wait for the actual render-complete signal (set by PagedPreview's
    // onReady, via PrintView) rather than a fixed timeout — pagination time
    // scales with document length, so a fixed sleep would be flaky.
    await page.waitForSelector('body[data-render-ready="true"]', { timeout: 30_000 });

    await page.emulateMedia({ media: "print" });

    // Zero Chromium-applied margin: the rendered page's own @page rule
    // already encodes the true IEEE margins (Letter 0.75in/1in/0.625in, or
    // the A4 override — see IEEEConferenceTemplate.tsx) — a second margin
    // here would double up on top of that.
    //
    // preferCSSPageSize is what actually makes A4 export correctly:
    // Playwright's page.pdf() defaults to Letter regardless of any @page
    // size CSS unless this is set — without it, an A4 document would still
    // export at Letter dimensions even though the on-screen preview (which
    // isn't subject to this Playwright-specific default) shows A4 correctly.
    const info = await page.evaluate(() => {
      const paper = document.querySelector(".ieee-paper");
      const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? "";
      const names = [...document.querySelectorAll(".ieee-author-name")].map((el) => el.textContent.trim());
      const blind = paper?.getAttribute("data-double-blind") === "true";
      return {
        title: text(".ieee-title"),
        authors: blind ? "" : text(".ieee-journal-authors") || names.filter(Boolean).join(", "),
        keywords: text(".ieee-keywords")
          .replace(/^Index Terms—/, "")
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        submission: paper?.getAttribute("data-mode") === "submission",
      };
    });

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return await finalizePdf(pdf, info);
  } finally {
    signal?.removeEventListener("abort", closeOnAbort);
    await browser.close().catch(() => {});
  }
}
