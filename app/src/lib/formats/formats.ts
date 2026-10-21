import type { Document } from "../../types/document";
import { copyrightText, cssString } from "./copyright";
import { journalHeader } from "./journal";

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

export type FormatId = Document["meta"]["template"];

export type FormatSpec = {
  id: FormatId;
  label: string;
  description: string;
  geometry: Record<PaperSize, PageGeometry>;
  /** "journal": author line + first-page affiliation footnote + running head. */
  frontMatter: "conference" | "journal";
  biographies: boolean;
  /** Abstract length IEEE asks for in this format; min 0 means no minimum. */
  abstractWords: { min: number; max: number };
  /** CompSoc uses Arabic section numbers; everything else uses Roman / A / 1. */
  headingScheme: "roman" | "arabic";
  /** Suggested venue page limit when switching to this format; null means leave the paper's limit alone. */
  defaultPageLimit: number | null;
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
  frontMatter: "conference",
  biographies: false,
  abstractWords: { min: 0, max: 150 },
  headingScheme: "roman",
  defaultPageLimit: null,
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

/**
 * Single-column review manuscript (IEEEtran peerreview / onecolumn draft):
 * 6.5in text block, 1in margins, 12pt body at 1.5 line spacing.
 */
export const IEEE_PEER_REVIEW: FormatSpec = {
  id: "ieee-peer-review",
  label: "IEEE Peer-review draft",
  description: "Single column, 12pt, 1.5 spacing — for journal review copies and advisors.",
  geometry: {
    letter: {
      size: "letter",
      margin: { top: "1in", bottom: "1in", left: "1in", right: "1in" },
      columnCount: 1,
      columnWidth: "6.5in",
      columnGap: "0in",
      textWidth: "6.5in",
    },
    a4: {
      size: "A4",
      margin: { top: "25mm", bottom: "25mm", left: "25mm", right: "25mm" },
      columnCount: 1,
      columnWidth: "160mm",
      columnGap: "0mm",
      textWidth: "160mm",
    },
  },
  frontMatter: "conference",
  biographies: false,
  abstractWords: { min: 150, max: 250 },
  headingScheme: "roman",
  defaultPageLimit: null,
};

/**
 * IEEE Transactions / Journals (IEEEtran journal): same two-column grid as
 * conferences, plus a running head with the page number, a first-page
 * affiliation footnote and author biographies.
 */
export const IEEE_JOURNAL: FormatSpec = {
  id: "ieee-journal",
  label: "IEEE Journal / Transactions",
  description: "Two-column journal article with running heads, affiliation footnote and author biographies.",
  geometry: IEEE_CONFERENCE.geometry,
  frontMatter: "journal",
  biographies: true,
  abstractWords: { min: 150, max: 250 },
  headingScheme: "roman",
  defaultPageLimit: null,
};

/**
 * IEEE Technical note / correspondence (IEEEtran technote): the journal layout
 * set in 9pt, without author biographies.
 */
export const IEEE_TECHNOTE: FormatSpec = {
  id: "ieee-technote",
  label: "IEEE Technical Note",
  description: "Short journal item in 9pt with running heads and affiliation footnote; no biographies.",
  geometry: IEEE_CONFERENCE.geometry,
  frontMatter: "journal",
  biographies: false,
  abstractWords: { min: 0, max: 250 },
  headingScheme: "roman",
  defaultPageLimit: null,
};

/**
 * IEEE Access (ieeeaccess.cls): 177.53mm text block, 85.29mm columns, 6.95mm
 * gap, journal front matter and biographies. Margins centre the text block.
 */
export const IEEE_ACCESS: FormatSpec = {
  id: "ieee-access",
  label: "IEEE Access",
  description: "Open-access journal article: Access column grid, running heads, affiliation footnote and biographies.",
  geometry: {
    letter: {
      size: "letter",
      margin: { top: "0.85in", bottom: "0.85in", left: "19.185mm", right: "19.185mm" },
      columnCount: 2,
      columnWidth: "85.29mm",
      columnGap: "6.95mm",
      textWidth: "177.53mm",
    },
    a4: {
      size: "A4",
      margin: { top: "30.11mm", bottom: "30.11mm", left: "16.235mm", right: "16.235mm" },
      columnCount: 2,
      columnWidth: "85.29mm",
      columnGap: "6.95mm",
      textWidth: "177.53mm",
    },
  },
  frontMatter: "journal",
  biographies: true,
  abstractWords: { min: 0, max: 200 },
  headingScheme: "roman",
  defaultPageLimit: null,
};

/**
 * IEEE Computer Society conference (IEEEtran conference,compsoc): 0.75in side
 * margins, 1in top/bottom, 3.375in columns on Letter; Arabic section numbers.
 */
export const IEEE_COMPSOC_CONFERENCE: FormatSpec = {
  id: "ieee-compsoc-conference",
  label: "IEEE CompSoc Conference",
  description: "Computer Society conference paper: 3.375in columns, 0.75in side margins, Arabic section numbers.",
  geometry: {
    letter: {
      size: "letter",
      margin: { top: "1in", bottom: "1in", left: "0.75in", right: "0.75in" },
      columnCount: 2,
      columnWidth: "3.375in",
      columnGap: "0.25in",
      textWidth: "7in",
    },
    // CompSoc conference keeps the inch margins fixed when the page size changes.
    a4: {
      size: "A4",
      margin: { top: "25.4mm", bottom: "25.4mm", left: "19.05mm", right: "19.05mm" },
      columnCount: 2,
      columnWidth: "82.775mm",
      columnGap: "6.35mm",
      textWidth: "171.9mm",
    },
  },
  frontMatter: "conference",
  biographies: false,
  abstractWords: { min: 0, max: 150 },
  headingScheme: "arabic",
  defaultPageLimit: null,
};

/**
 * IEEE Computer Society journal (IEEEtran journal,compsoc): 7in + 12bp text
 * width, 3.5in columns, 0.625in top/bottom on Letter, Arabic section numbers,
 * sans-serif titles and headings.
 */
export const IEEE_COMPSOC_JOURNAL: FormatSpec = {
  id: "ieee-compsoc-journal",
  label: "IEEE CompSoc Journal",
  description: "Computer Society journal article: wider text block, Arabic section numbers, Helvetica titles.",
  geometry: {
    letter: {
      size: "letter",
      margin: { top: "0.625in", bottom: "0.625in", left: "0.6667in", right: "0.6667in" },
      columnCount: 2,
      columnWidth: "3.5in",
      columnGap: "0.1667in",
      textWidth: "7.1667in",
    },
    a4: {
      size: "A4",
      margin: { top: "24.675mm", bottom: "24.675mm", left: "13.983mm", right: "13.983mm" },
      columnCount: 2,
      columnWidth: "3.5in",
      columnGap: "0.1667in",
      textWidth: "7.1667in",
    },
  },
  frontMatter: "journal",
  biographies: true,
  abstractWords: { min: 150, max: 250 },
  headingScheme: "arabic",
  defaultPageLimit: null,
};

/**
 * IEEE Letters (SPL, WCL and similar): journal layout with a 4-page default
 * limit and a short abstract; no author biographies.
 */
export const IEEE_LETTERS: FormatSpec = {
  id: "ieee-letters",
  label: "IEEE Letters",
  description: "Short letter (SPL, WCL, …): journal layout, 4-page default limit, no biographies.",
  geometry: IEEE_CONFERENCE.geometry,
  frontMatter: "journal",
  biographies: false,
  abstractWords: { min: 0, max: 100 },
  headingScheme: "roman",
  defaultPageLimit: 4,
};

export const FORMATS: Record<FormatId, FormatSpec> = {
  "ieee-conference": IEEE_CONFERENCE,
  "ieee-journal": IEEE_JOURNAL,
  "ieee-technote": IEEE_TECHNOTE,
  "ieee-peer-review": IEEE_PEER_REVIEW,
  "ieee-access": IEEE_ACCESS,
  "ieee-compsoc-conference": IEEE_COMPSOC_CONFERENCE,
  "ieee-compsoc-journal": IEEE_COMPSOC_JOURNAL,
  "ieee-letters": IEEE_LETTERS,
};

export const FORMAT_LIST: FormatSpec[] = [
  IEEE_CONFERENCE,
  IEEE_JOURNAL,
  IEEE_TECHNOTE,
  IEEE_PEER_REVIEW,
  IEEE_ACCESS,
  IEEE_COMPSOC_CONFERENCE,
  IEEE_COMPSOC_JOURNAL,
  IEEE_LETTERS,
];

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
  meta: Pick<
    Document["meta"],
    "template" | "paperSize" | "showPageNumbers" | "fontFamily" | "draftWatermark" | "copyrightNotice" | "journal"
  >
): string {
  const pageNumberFont = paperFontStack(meta);
  const g = getGeometry(meta);
  const isJournal = getFormat(meta).frontMatter === "journal";
  const rules = [
    `size: ${g.size};`,
    `margin-top: ${g.margin.top};`,
    `margin-bottom: ${g.margin.bottom};`,
    `margin-left: ${g.margin.left};`,
    `margin-right: ${g.margin.right};`,
  ];
  if (isJournal) {
    const head = `font-family: ${pageNumberFont}; font-size: 7pt; vertical-align: bottom; padding-bottom: 12pt;`;
    rules.push(`@top-left { content: ${cssString(journalHeader(meta.journal))}; ${head} }`);
    rules.push(`@top-right { content: counter(page); ${head} }`);
  } else if (meta.showPageNumbers) {
    rules.push(`@bottom-center { content: counter(page); font-family: ${pageNumberFont}; font-size: 8pt; }`);
  }
  if (meta.draftWatermark) {
    rules.push(
      `${isJournal ? "@bottom-center" : "@top-right"} { content: "DRAFT — not for submission"; font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #b91c1c; letter-spacing: 0.05em; }`
    );
  }
  const css = [`@page { ${rules.join(" ")} }`];
  const notice =
    meta.copyrightNotice && meta.template === "ieee-conference" ? copyrightText(meta.copyrightNotice) : "";
  if (notice) {
    css.push(
      `@page :first { @bottom-left { content: ${cssString(notice)}; font-family: ${pageNumberFont}; font-size: 8pt; vertical-align: top; text-align: left; } }`
    );
  }
  return css.join("\n");
}
