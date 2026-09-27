import { tokenTextToInline } from "./inlineTokens";

const DOI_RE = /\b10\.\d{4,9}\/[^\s"'<>()[\]{}]+/gi;

/** Unique DOIs mentioned in a piece of text, without trailing punctuation. */
export function findDois(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(DOI_RE)) {
    found.add(match[0].replace(/[.,;:]+$/, ""));
  }
  return [...found];
}

const REFERENCE_LINE_RE = /^\s*(?:[-*]\s+)?(?:\[\d+\]|\d+\.)\s+.*\b(?:19|20)\d{2}\b/;
const AUTHOR_HINT_RE = /(?:et al\.|[A-Z]\.\s?[A-Z][a-z]+|["“].+["”]|\bIEEE\b|\bProc\.|\bJournal\b|\bTrans\.)/;

/** True when the text contains what looks like a list of bibliographic references. */
export function looksLikeReferenceList(text: string): boolean {
  const lines = text.split("\n").filter((l) => REFERENCE_LINE_RE.test(l) && AUTHOR_HINT_RE.test(l));
  return lines.length >= 2 || /^#{1,6}\s*(references|bibliography)\b/im.test(text);
}

export type PreparedText = {
  paragraphs: string[];
  /** Typed citation numbers like [3] that were removed. */
  removedCitations: number;
  /** Lines dropped because they sat under a References heading. */
  droppedReferenceLines: number;
};

function stripInlineMarkdown(line: string): string {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1");
}

/**
 * Converts an assistant reply (Markdown) into plain paragraphs safe to put in
 * a paper: formatting removed, any reference list dropped and typed citation
 * numbers stripped, since the only citations allowed are ones the author
 * links to a reference they added themselves.
 */
export function prepareAssistantTextForPaper(markdown: string): PreparedText {
  const paragraphs: string[] = [];
  let removedCitations = 0;
  let droppedReferenceLines = 0;
  let inReferences = false;
  let inCode = false;
  let current: string[] = [];

  const flush = () => {
    const text = current.join(" ").replace(/\s+/g, " ").trim();
    current = [];
    if (!text) return;
    const result = tokenTextToInline(text, new Map());
    removedCitations += result.strayCitations.length;
    const cleaned = result.content.map((n) => (n.type === "text" ? n.text : "")).join("").trim();
    if (cleaned) paragraphs.push(cleaned);
  };

  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*```/.test(raw)) {
      inCode = !inCode;
      flush();
      continue;
    }
    if (inCode) continue;
    const heading = raw.match(/^\s*#{1,6}\s+(.*)$/) ?? raw.match(/^\s*\*\*([^*]+)\*\*\s*:?\s*$/);
    if (heading) {
      flush();
      inReferences = /^(references|bibliography|sources|citations)\b/i.test(heading[1].trim());
      continue;
    }
    if (inReferences) {
      if (raw.trim()) droppedReferenceLines += 1;
      continue;
    }
    if (!raw.trim() || /^\s*(-{3,}|\*{3,})\s*$/.test(raw)) {
      flush();
      continue;
    }
    const listItem = raw.match(/^\s*(?:[-*+]|\d+\.)\s+(.*)$/);
    if (listItem) {
      flush();
      current.push(stripInlineMarkdown(listItem[1]));
      flush();
      continue;
    }
    current.push(stripInlineMarkdown(raw.trim()));
  }
  flush();
  return { paragraphs, removedCitations, droppedReferenceLines };
}
