export const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;

/** Comma-separated input to a clean, de-duplicated tag list (case-insensitive, first spelling wins). */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input.split(",")) {
    const tag = raw.replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === MAX_TAGS) break;
  }
  return tags;
}

/** Every tag used across the papers, alphabetically. */
export function allTags(papers: { tags: string[] }[]): string[] {
  const byKey = new Map<string, string>();
  for (const p of papers) for (const t of p.tags) if (!byKey.has(t.toLowerCase())) byKey.set(t.toLowerCase(), t);
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

export function hasTag(paper: { tags: string[] }, tag: string): boolean {
  return paper.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
}
