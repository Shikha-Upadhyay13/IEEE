import type { ReferenceFields } from "./generateReferenceText";
import { fetchCrossrefWork, searchCrossref, workToFields, workYear, type CrossrefWork } from "./doiLookup";

export type VerifyResult =
  | { status: "verified"; doi: string }
  | { status: "mismatch"; doi: string; differences: string[]; crossref: ReferenceFields }
  | { status: "not-found"; reason: string };

const MATCH_THRESHOLD = 0.85;
const CANDIDATE_THRESHOLD = 0.5;

function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Dice coefficient over title words: 1 for identical titles, 0 for nothing in common. */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const t of ta) counts.set(t, (counts.get(t) ?? 0) + 1);
  let shared = 0;
  for (const t of tb) {
    const n = counts.get(t) ?? 0;
    if (n > 0) {
      shared += 1;
      counts.set(t, n - 1);
    }
  }
  return (2 * shared) / (ta.length + tb.length);
}

/** Compare the user's reference with a CrossRef record. Pure — no network. */
export function compareWithWork(fields: ReferenceFields, work: CrossrefWork): VerifyResult {
  const crossref = workToFields(work);
  const doi = work.DOI ?? "";
  const similarity = titleSimilarity(fields.title, crossref.title);
  if (similarity < CANDIDATE_THRESHOLD) {
    return { status: "not-found", reason: "No CrossRef record matches this title." };
  }

  const differences: string[] = [];
  if (similarity < MATCH_THRESHOLD) differences.push(`Title in CrossRef: "${crossref.title}"`);
  const year = workYear(work);
  if (fields.year.trim() && year && fields.year.trim() !== year) {
    differences.push(`Year in CrossRef: ${year} (you have ${fields.year.trim()})`);
  }
  if (fields.volume.trim() && crossref.volume && fields.volume.trim() !== crossref.volume) {
    differences.push(`Volume in CrossRef: ${crossref.volume} (you have ${fields.volume.trim()})`);
  }

  return differences.length === 0 ? { status: "verified", doi } : { status: "mismatch", doi, differences, crossref };
}

export async function verifyReference(fields: ReferenceFields): Promise<VerifyResult> {
  if (fields.doi?.trim()) {
    const work = await fetchCrossrefWork(fields.doi);
    return compareWithWork(fields, work);
  }
  if (!fields.title.trim()) {
    return { status: "not-found", reason: "Add a title (or a DOI) so the reference can be checked." };
  }
  const query = [fields.title, fields.authors, fields.year].filter((s) => s.trim()).join(" ");
  const candidates = await searchCrossref(query);
  let best: VerifyResult = { status: "not-found", reason: "No CrossRef record matches this title." };
  let bestScore = -1;
  for (const work of candidates) {
    const score = titleSimilarity(fields.title, work.title?.[0] ?? "");
    if (score > bestScore) {
      bestScore = score;
      best = compareWithWork(fields, work);
    }
  }
  return best;
}
