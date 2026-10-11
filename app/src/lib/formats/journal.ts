import type { Document } from "../../types/document";

export type JournalInfo = NonNullable<Document["meta"]["journal"]>;

export const EMPTY_JOURNAL: JournalInfo = { name: "", volume: "", number: "", date: "", received: "" };

/** "IEEE TRANSACTIONS ON X, VOL. 12, NO. 3, MARCH 2026" — parts left blank are skipped. */
export function journalHeader(journal: JournalInfo | null | undefined): string {
  const j = journal ?? EMPTY_JOURNAL;
  const parts = [
    j.name.trim() || "IEEE TRANSACTIONS",
    j.volume.trim() && `VOL. ${j.volume.trim()}`,
    j.number.trim() && `NO. ${j.number.trim()}`,
    j.date.trim(),
  ].filter(Boolean);
  return parts.join(", ").toUpperCase();
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

/** Author names as IEEE journals print them under the title: "A, B, and C". */
export function authorLine(titleBlock: Document["titleBlock"]): string {
  return joinNames(titleBlock.authors.map((a) => a.name.trim()).filter(Boolean));
}

/**
 * The first-page footnote IEEE journals use instead of affiliations under the
 * names: "Manuscript received …", then "A and B are with … (e-mail: …)."
 */
export function affiliationFootnote(
  titleBlock: Document["titleBlock"],
  received: string | undefined
): string[] {
  const lines: string[] = [];
  if (received?.trim()) lines.push(`Manuscript received ${received.trim().replace(/\.$/, "")}.`);
  const named = titleBlock.authors.filter((a) => a.name.trim());
  const placed = new Set<string>();
  for (const aff of titleBlock.affiliations) {
    const authors = named.filter((a) => a.affiliationRefs.includes(aff.id));
    if (authors.length === 0 || !aff.text.trim()) continue;
    authors.forEach((a) => placed.add(a.id));
    const emails = authors.map((a) => a.email?.trim()).filter(Boolean);
    const verb = authors.length === 1 ? "is" : "are";
    const text = aff.text.trim();
    const tail = emails.length ? `${text} (e-mail: ${emails.join("; ")}).` : text.endsWith(".") ? text : `${text}.`;
    lines.push(`${joinNames(authors.map((a) => a.name.trim()))} ${verb} with ${tail}`);
  }
  for (const a of named) {
    if (!placed.has(a.id) && a.email?.trim()) lines.push(`${a.name.trim()} (e-mail: ${a.email.trim()}).`);
  }
  return lines;
}
