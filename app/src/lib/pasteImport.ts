import type { BodyNode } from "../types/document";
import { generateId } from "./id";

/** A flat line of pasted content: a heading (with level) or a paragraph. */
export type PastedBlock = { kind: "heading"; level: number; text: string } | { kind: "paragraph"; text: string };

export type PasteImport = {
  title: string | null;
  abstract: string | null;
  keywords: string[];
  body: BodyNode[];
  sectionCount: number;
  paragraphCount: number;
  /** Lines under a References heading — not imported as structured references. */
  skippedReferenceLines: number;
  /** Author and affiliation lines between the title and the abstract. */
  skippedFrontMatterLines: number;
};

const ROMAN = /^(?=[IVXLC]+\b)[IVXLC]+\.\s+/;
const LETTER = /^[A-Z]\.\s+/;
const NUMBERED = /^(\d{1,2}(?:\.\d{1,2})*)\.?\s+/;

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isAllCaps(text: string): boolean {
  return /[A-Z]/.test(text) && text === text.toUpperCase();
}

function titleCase(text: string): string {
  const small = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);
  return text
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * Strips IEEE/Word numbering ("II. RELATED WORK", "3.1 Datasets", "B. Setup")
 * and infers the depth that numbering implies. Returns null when the text
 * doesn't look like a numbered heading.
 */
export function parseNumberedHeading(raw: string): { text: string; level: number } | null {
  const text = collapse(raw);
  if (text.length > 90 || /[.:;]$/.test(text)) return null;
  let m = text.match(ROMAN);
  if (m) {
    const rest = text.slice(m[0].length);
    // "C. Setup" is a lettered subsection, not section 100. IEEE section
    // headings are set in capitals and subsections in title case, so a
    // single ambiguous letter is decided by the heading's case.
    const singleLetter = m[0].trim().length === 2;
    const level = singleLetter && m[0][0] !== "I" && !isAllCaps(rest) ? 2 : 1;
    return { text: tidyHeading(rest), level };
  }
  m = text.match(NUMBERED);
  if (m) {
    const rest = text.slice(m[0].length);
    if (!/^[A-Za-z]/.test(rest)) return null;
    return { text: tidyHeading(rest), level: Math.min(3, m[1].split(".").length) };
  }
  m = text.match(LETTER);
  if (m) return { text: tidyHeading(text.slice(m[0].length)), level: 2 };
  return null;
}

function tidyHeading(text: string): string {
  const t = collapse(text);
  return isAllCaps(t) ? titleCase(t) : t;
}

/**
 * Plain-text fallback. Word and Google Docs put each paragraph on its own
 * line, so every non-empty line is a block; numbered or all-caps short lines
 * become headings.
 */
export function textToBlocks(text: string): PastedBlock[] {
  const blocks: PastedBlock[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = collapse(raw);
    if (!line) continue;
    const numbered = parseNumberedHeading(line);
    if (numbered) blocks.push({ kind: "heading", ...numbered });
    else if (line.length <= 60 && isAllCaps(line) && !/[.:;]$/.test(line)) {
      blocks.push({ kind: "heading", level: 1, text: titleCase(line) });
    } else blocks.push({ kind: "paragraph", text: line });
  }
  return blocks;
}

const ABSTRACT_RE = /^abstract\s*[—–:\-.]?\s*/i;
const KEYWORDS_RE = /^(index terms|keywords)\s*[—–:\-.]?\s*/i;

function headingKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z ]/g, "").trim();
}

/** Turns flat blocks into a section tree, peeling off title, abstract, keywords and references. */
export function blocksToImport(blocks: PastedBlock[]): PasteImport {
  let title: string | null = null;
  let abstract: string | null = null;
  let keywords: string[] = [];
  let skippedReferenceLines = 0;
  let skippedFrontMatterLines = 0;
  let sectionCount = 0;
  let paragraphCount = 0;

  const body: BodyNode[] = [];
  const stack: { level: number; node: Extract<BodyNode, { type: "section" }> }[] = [];
  let mode: "body" | "abstract" | "keywords" | "references" = "body";
  let seenHeading = false;

  const addNode = (node: BodyNode) => {
    const parent = stack[stack.length - 1];
    if (parent) parent.node.children.push(node);
    else body.push(node);
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = collapse(block.text);
    if (!text) continue;

    if (block.kind === "heading") {
      const key = headingKey(text);
      if (!seenHeading && title === null && block.level === 0) {
        title = text;
        continue;
      }
      if (key === "abstract") {
        mode = "abstract";
        continue;
      }
      if (key === "keywords" || key === "index terms") {
        mode = "keywords";
        continue;
      }
      if (key === "references" || key === "bibliography") {
        mode = "references";
        continue;
      }
      mode = "body";
      seenHeading = true;
      const level = Math.max(1, Math.min(3, block.level));
      while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
      const node: Extract<BodyNode, { type: "section" }> = {
        type: "section",
        id: generateId("sec"),
        heading: text,
        level: stack.length + 1,
        children: [],
      };
      addNode(node);
      stack.push({ level, node });
      sectionCount += 1;
      continue;
    }

    if (mode === "references") {
      skippedReferenceLines += 1;
      continue;
    }
    if (ABSTRACT_RE.test(text) && abstract === null && !seenHeading) {
      abstract = text.replace(ABSTRACT_RE, "");
      continue;
    }
    if (KEYWORDS_RE.test(text) && keywords.length === 0 && !seenHeading) {
      keywords = splitKeywords(text.replace(KEYWORDS_RE, ""));
      continue;
    }
    if (mode === "abstract") {
      abstract = abstract ? `${abstract} ${text}` : text;
      continue;
    }
    if (mode === "keywords") {
      keywords = splitKeywords(text);
      mode = "body";
      continue;
    }
    // A short first line before any heading is almost always the paper title,
    // and short lines between it and the abstract are author/affiliation lines.
    if (!seenHeading && abstract === null && body.length === 0 && text.length <= 200 && !/[.!?]$/.test(text)) {
      if (title === null) title = text;
      else skippedFrontMatterLines += 1;
      continue;
    }
    addNode({ type: "paragraph", id: generateId("p"), content: [{ type: "text", text }] });
    paragraphCount += 1;
  }

  return {
    title,
    abstract,
    keywords,
    body,
    sectionCount,
    paragraphCount,
    skippedReferenceLines,
    skippedFrontMatterLines,
  };
}

function splitKeywords(text: string): string[] {
  return text
    .replace(/\.$/, "")
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

/** Browser-only: reads headings and paragraphs out of clipboard HTML from Word or Google Docs. */
export function htmlToBlocks(html: string): PastedBlock[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("style, script, meta, title, xml").forEach((el) => el.remove());
  const blocks: PastedBlock[] = [];

  const headingLevel = (el: Element): number | null => {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return Number(tag[1]);
    // Word marks headings with a class or an outline level instead of <hN>.
    const cls = el.getAttribute("class") ?? "";
    const classMatch = cls.match(/MsoHeading(\d)/i);
    if (classMatch) return Number(classMatch[1]);
    if (/MsoTitle/i.test(cls)) return 0;
    const style = el.getAttribute("style") ?? "";
    const outline = style.match(/mso-outline-level:\s*(\d)/i);
    if (outline) return Number(outline[1]);
    return null;
  };

  const visit = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    const level = headingLevel(el);
    const text = collapse(el.textContent ?? "");
    if (level !== null) {
      if (text) {
        const numbered = parseNumberedHeading(text);
        blocks.push({ kind: "heading", level: level === 0 ? 0 : (numbered?.level ?? level), text: numbered?.text ?? tidyHeading(text) });
      }
      return;
    }
    if (tag === "p" || tag === "li" || tag === "blockquote" || tag === "pre") {
      if (!text) return;
      const numbered = parseNumberedHeading(text);
      const boldOnly = el.querySelector("b, strong") !== null && collapse(el.querySelector("b, strong")?.textContent ?? "") === text;
      if (numbered && (boldOnly || isAllCaps(numbered.text) || text.length <= 60)) {
        blocks.push({ kind: "heading", ...numbered });
      } else {
        blocks.push({ kind: "paragraph", text });
      }
      return;
    }
    if (tag === "table") return;
    const children = Array.from(el.children);
    if (children.length === 0) {
      if (text) blocks.push({ kind: "paragraph", text });
      return;
    }
    children.forEach(visit);
  };

  Array.from(doc.body.children).forEach(visit);
  return blocks;
}
