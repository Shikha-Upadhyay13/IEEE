import type { Reference } from "../types/document";
import { cleanDoi } from "./doiLookup";
import { titleSimilarity } from "./referenceVerify";

const DUPLICATE_THRESHOLD = 0.9;
const IEEE_MAX_LISTED_AUTHORS = 6;

/** "pp. 549-557" → "pp. 549–557": IEEE sets page ranges with an en dash. */
const HYPHEN_PAGE_RANGE = /\b(pp?\.\s*[A-Za-z]?\d+)\s*-{1,2}\s*([A-Za-z]?\d+)/g;

export function fixPageRangeDashes(text: string): string {
  return text.replace(HYPHEN_PAGE_RANGE, "$1–$2");
}

export function hasHyphenPageRange(text: string): boolean {
  return fixPageRangeDashes(text) !== text;
}

/** Pairs of reference indexes that look like the same work (same DOI, or near-identical text). */
export function findDuplicateReferences(refs: Reference[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      const a = refs[i];
      const b = refs[j];
      const doiA = a.fields.doi ? cleanDoi(a.fields.doi).toLowerCase() : "";
      const doiB = b.fields.doi ? cleanDoi(b.fields.doi).toLowerCase() : "";
      const sameDoi = doiA !== "" && doiA === doiB;
      const titleA = a.fields.title?.trim() || a.renderedText;
      const titleB = b.fields.title?.trim() || b.renderedText;
      if (sameDoi || (titleA.trim() && titleSimilarity(titleA, titleB) >= DUPLICATE_THRESHOLD)) pairs.push([i, j]);
    }
  }
  return pairs;
}

/** Counts names in an author field: "A, B, and C", "A; B; C" and "A and B" all work. */
export function countAuthors(authors: string): number {
  if (/\bet al\.?/i.test(authors)) return 0;
  return authors
    .split(/;|,\s*(?:and\s+)?|\s+and\s+|&/i)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

export function listsTooManyAuthors(ref: Reference): boolean {
  return countAuthors(ref.fields.authors ?? "") > IEEE_MAX_LISTED_AUTHORS;
}

/** Structured references that have never been matched against Crossref. */
export function isUnverified(ref: Reference): boolean {
  return Boolean(ref.fields.title?.trim()) && !ref.fields.verifiedAt;
}
