import { parseBibtex } from "../bibtex";
import { countWords } from "../checklist";
import { generateReferenceText, type ReferenceFields } from "../generateReferenceText";

/** IEEE lists up to six authors; with more, the first author plus "et al." */
export const IEEE_MAX_LISTED_AUTHORS = 6;

function initialsName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  let first: string;
  let last: string;
  if (trimmed.includes(",")) {
    const [l, f = ""] = trimmed.split(",").map((s) => s.trim());
    last = l;
    first = f;
  } else {
    const parts = trimmed.split(" ");
    if (parts.length === 1) return trimmed;
    last = parts[parts.length - 1];
    first = parts.slice(0, -1).join(" ");
  }
  const initials = first
    .split(/[\s]+/)
    .filter(Boolean)
    .map((part) =>
      // Already an initial ("J." or "J") stays one; hyphenated names keep the hyphen ("J.-P.").
      part
        .split("-")
        .map((p) => (p.replace(/\./g, "") ? `${p.replace(/\./g, "")[0].toUpperCase()}.` : ""))
        .join("-")
    )
    .join(" ");
  return initials ? `${initials} ${last}` : last;
}

/**
 * Turns a free-form author list ("Jane Smith; Doe, John" or one per line)
 * into IEEE form: "J. Smith and J. Doe", "A. B, C. D, and E. F".
 */
export function formatAuthorNames(raw: string): string {
  const names = raw
    .split(/\n|;|\s+and\s+|&/i)
    .map(initialsName)
    .filter(Boolean);
  if (names.length === 0) return "";
  if (names.length > IEEE_MAX_LISTED_AUTHORS) return `${names[0]} et al.`;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function formatIeeeReference(fields: ReferenceFields): string {
  const text = generateReferenceText(fields);
  const doi = fields.doi?.trim();
  return text && doi ? `${text} doi: ${doi}.` : text;
}

export type ConvertedReference = { number: number; text: string; fields: ReferenceFields; missing: string[] };

const REQUIRED_FIELDS: (keyof ReferenceFields)[] = ["authors", "title", "venue", "year"];

export function bibtexToIeee(bibtex: string): ConvertedReference[] {
  return parseBibtex(bibtex).map((fields, i) => ({
    number: i + 1,
    text: generateReferenceText(fields),
    fields,
    missing: REQUIRED_FIELDS.filter((key) => !String(fields[key] ?? "").trim()),
  }));
}

export function numberedList(refs: ConvertedReference[]): string {
  return refs.map((r) => `[${r.number}] ${r.text}`).join("\n");
}

export type AbstractStats = {
  words: number;
  characters: number;
  sentences: number;
  warnings: string[];
};

export function abstractStats(text: string): AbstractStats {
  const trimmed = text.trim();
  const warnings: string[] = [];
  if (/\[\d+(?:[,–-]\s*\d+)*\]/.test(trimmed)) {
    warnings.push("Contains a citation like [1]. IEEE abstracts should not cite references.");
  }
  if (/\$[^$]+\$|\\\(|\\\[|\\begin\{equation/.test(trimmed)) {
    warnings.push("Contains LaTeX math. Avoid displayed equations in the abstract.");
  }
  if (/\b(Fig\.|Figure|Table)\s+\d+/i.test(trimmed)) {
    warnings.push("Refers to a figure or table. The abstract should stand on its own.");
  }
  return {
    words: countWords(trimmed),
    characters: trimmed.length,
    sentences: trimmed ? (trimmed.match(/[^.!?]+[.!?]+(\s|$)/g)?.length ?? 1) : 0,
    warnings,
  };
}
