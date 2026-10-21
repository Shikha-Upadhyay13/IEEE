import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { createSamplePaper } from "../src/data/samplePaper";
import { FORMAT_LIST, getGeometry, type PaperSize } from "../src/lib/formats/formats";

// Renders the sample paper through the same /print route pdf-service uses,
// with the export-token lookup answered locally, and checks the result against
// the format registry. No Supabase project or pdf-service is needed.

const SIZES: PaperSize[] = ["letter", "a4"];
const PAGE_INCHES = { letter: { width: 8.5, height: 11 }, A4: { width: 210 / 25.4, height: 297 / 25.4 } };
const TOLERANCE_IN = 0.02;

// Pages the sample paper takes in each format. A change here is a layout
// change: confirm it is intended before updating the number.
const EXPECTED_PAGES: Record<string, number> = {
  "ieee-conference-letter": 2,
  "ieee-conference-a4": 2,
  "ieee-journal-letter": 1,
  "ieee-journal-a4": 1,
  "ieee-technote-letter": 1,
  "ieee-technote-a4": 1,
  "ieee-peer-review-letter": 2,
  "ieee-peer-review-a4": 2,
  "ieee-access-letter": 2,
  "ieee-access-a4": 2,
  "ieee-compsoc-conference-letter": 2,
  "ieee-compsoc-conference-a4": 2,
  "ieee-compsoc-journal-letter": 1,
  "ieee-compsoc-journal-a4": 1,
  "ieee-letters-letter": 1,
  "ieee-letters-a4": 1,
};

const inches = (length: string) => {
  const value = parseFloat(length);
  return length.endsWith("mm") ? value / 25.4 : value;
};

async function renderPrintView(page: Page, paper: unknown) {
  await page.route("**/rest/v1/rpc/get_document_by_export_token*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(paper) }),
  );
  await page.goto("/print/fidelity?token=fidelity");
  await page.waitForSelector('body[data-render-ready="true"]', { timeout: 30_000 });
}

/** Page boxes and the left/right edges of every body-paragraph fragment, in inches from its page's left edge. */
function measure(page: Page) {
  return page.evaluate(() => {
    const PX = 96;
    const pages = [...document.querySelectorAll<HTMLElement>(".pagedjs_page")];
    const boxes = pages.map((p) => p.getBoundingClientRect());
    const lefts = new Set<number>();
    let right = 0;
    for (const para of document.querySelectorAll<HTMLElement>(".ieee-columns .ieee-paragraph")) {
      const host = para.closest(".pagedjs_page");
      if (!host) continue;
      const origin = host.getBoundingClientRect().left;
      for (const r of para.getClientRects()) {
        if (r.width < 1) continue;
        lefts.add(Math.round(((r.left - origin) / PX) * 100) / 100);
        right = Math.max(right, (r.right - origin) / PX);
      }
    }
    return {
      pages: boxes.length,
      width: boxes[0].width / PX,
      height: boxes[0].height / PX,
      columnLefts: [...lefts].sort((a, b) => a - b),
      textRight: right,
    };
  });
}

for (const format of FORMAT_LIST) {
  for (const size of SIZES) {
    const name = `${format.id}-${size}`;

    test(`${name}: page size, page count, columns and first page`, async ({ page }, testInfo) => {
      const paper = createSamplePaper();
      paper.meta = { ...paper.meta, template: format.id, paperSize: size };
      const g = getGeometry(paper.meta);
      const pageSize = PAGE_INCHES[g.size];

      await renderPrintView(page, paper);
      const m = await measure(page);

      expect(m.width).toBeCloseTo(pageSize.width, 1);
      expect(m.height).toBeCloseTo(pageSize.height, 1);

      // IEEE's A4 numbers leave 1.14 mm between the margins unused; the text block is centred in it.
      const between = pageSize.width - inches(g.margin.left) - inches(g.margin.right);
      const left = inches(g.margin.left) + (between - inches(g.textWidth)) / 2;
      const starts = Array.from({ length: g.columnCount }, (_, i) => left + i * (inches(g.columnWidth) + inches(g.columnGap)));
      expect(m.columnLefts.length).toBe(starts.length);
      m.columnLefts.forEach((x, i) => expect(Math.abs(x - starts[i])).toBeLessThan(TOLERANCE_IN));
      expect(m.textRight).toBeLessThan(left + inches(g.textWidth) + TOLERANCE_IN);

      expect(m.pages).toBe(EXPECTED_PAGES[name]);

      const shot = `${name}-first-page.png`;
      if (existsSync(testInfo.snapshotPath(shot, { kind: "screenshot" })) || ["all", "changed"].includes(testInfo.config.updateSnapshots)) {
        await expect(page.locator(".pagedjs_page").first()).toHaveScreenshot(shot, { maxDiffPixels: 50 });
      } else {
        testInfo.annotations.push({ type: "skipped screenshot", description: `No ${process.platform} baseline for ${shot}; run with --update-snapshots to record one.` });
      }

      await page.emulateMedia({ media: "print" });
      const pdf = await PDFDocument.load(await page.pdf({ printBackground: true, preferCSSPageSize: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } }));
      expect(pdf.getPageCount()).toBe(m.pages);
      for (const p of pdf.getPages()) {
        expect(p.getWidth() / 72).toBeCloseTo(pageSize.width, 1);
        expect(p.getHeight() / 72).toBeCloseTo(pageSize.height, 1);
      }
    });
  }
}
