import type { Document } from "../../types/document";

export type PaperSize = Document["meta"]["paperSize"];

/** Page geometry for one paper size. Lengths are CSS lengths in in or mm, never pt (CSS pt ≠ TeX pt). */
export type PageGeometry = {
  size: "letter" | "A4";
  margin: { top: string; bottom: string; left: string; right: string };
  columnCount: 1 | 2;
  columnWidth: string;
  columnGap: string;
  /** Width of the text block: columnCount × columnWidth + gaps. */
  textWidth: string;
};

export type FormatSpec = {
  id: string;
  label: string;
  description: string;
  geometry: Record<PaperSize, PageGeometry>;
};

/**
 * IEEE conference template (Word and LaTeX share these limits). Letter is
 * 2 × 3.5in columns with a 0.25in gap; A4 is 2 × 88mm with a 4.22mm gap
 * (conference-template-a4.docx).
 */
export const IEEE_CONFERENCE: FormatSpec = {
  id: "ieee-conference",
  label: "IEEE Conference",
  description: "Two-column conference paper (IEEE conference template).",
  geometry: {
    letter: {
      size: "letter",
      margin: { top: "0.75in", bottom: "1in", left: "0.625in", right: "0.625in" },
      columnCount: 2,
      columnWidth: "3.5in",
      columnGap: "0.25in",
      textWidth: "7.25in",
    },
    a4: {
      size: "A4",
      margin: { top: "19mm", bottom: "43mm", left: "14.32mm", right: "14.32mm" },
      columnCount: 2,
      columnWidth: "88mm",
      columnGap: "4.22mm",
      textWidth: "180.22mm",
    },
  },
};

// ieee-template.css's own font-family rule is the IEEE-compliant default
// (Times New Roman); this map only supplies inline overrides for the
// non-default, non-compliant choices.
export const FONT_STACKS: Record<string, string> = {
  arial: "Arial, Helvetica, sans-serif",
  helvetica: "Helvetica, Arial, sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  calibri: "Calibri, 'Segoe UI', sans-serif",
};

export const TIMES_STACK = "'Times New Roman', Times, serif";

export function paperFontStack(meta: Pick<Document["meta"], "fontFamily">): string {
  return FONT_STACKS[meta.fontFamily ?? "times"] ?? TIMES_STACK;
}

export const FORMATS: Record<string, FormatSpec> = {
  [IEEE_CONFERENCE.id]: IEEE_CONFERENCE,
};

export function getFormat(meta: Pick<Document["meta"], "template">): FormatSpec {
  return FORMATS[meta.template] ?? IEEE_CONFERENCE;
}

export function getGeometry(meta: Pick<Document["meta"], "template" | "paperSize">): PageGeometry {
  const format = getFormat(meta);
  return format.geometry[meta.paperSize] ?? format.geometry.letter;
}

/** CSS custom properties read by ieee-template.css for the text block and columns. */
export function layoutVariables(geometry: PageGeometry): Record<string, string> {
  return {
    "--ieee-text-width": geometry.textWidth,
    "--ieee-column-count": String(geometry.columnCount),
    "--ieee-column-width": geometry.columnWidth,
    "--ieee-column-gap": geometry.columnGap,
  };
}

/**
 * The @page rule for a document. Passed to Paged.js as its own stylesheet:
 * Paged.js only reads @page from stylesheets it is given, not from <style>
 * elements inside the content it paginates.
 */
export function buildPageCss(
  meta: Pick<Document["meta"], "template" | "paperSize" | "showPageNumbers" | "fontFamily">
): string {
  const pageNumberFont = paperFontStack(meta);
  const g = getGeometry(meta);
  const rules = [
    `size: ${g.size};`,
    `margin-top: ${g.margin.top};`,
    `margin-bottom: ${g.margin.bottom};`,
    `margin-left: ${g.margin.left};`,
    `margin-right: ${g.margin.right};`,
  ];
  if (meta.showPageNumbers) {
    rules.push(`@bottom-center { content: counter(page); font-family: ${pageNumberFont}; font-size: 8pt; }`);
  }
  return `@page { ${rules.join(" ")} }`;
}
