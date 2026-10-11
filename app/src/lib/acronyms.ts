/** Acronyms IEEE says need no definition. */
const WELL_KNOWN = new Set(["IEEE", "SI", "AC", "DC", "RMS", "CGS", "MKS", "OK", "PDF", "URL", "USA", "UK", "EU", "ID"]);

const ACRONYM = /\b[A-Z][A-Z0-9]*[A-Z][A-Z0-9]*s?\b/g;
const ROMAN = /^[IVXLCDM]+$/;

function stem(token: string): string {
  return token.endsWith("s") ? token.slice(0, -1) : token;
}

export type UndefinedAcronym = { acronym: string; blockId: string };

/**
 * Acronyms whose first use in the text isn't the "Long Form (LF)" definition.
 * Blocks are given in reading order.
 */
export function findUndefinedAcronyms(blocks: { id: string; text: string }[]): UndefinedAcronym[] {
  const seen = new Set<string>();
  const found: UndefinedAcronym[] = [];
  for (const block of blocks) {
    for (const match of block.text.matchAll(ACRONYM)) {
      const acronym = stem(match[0]);
      if (acronym.length < 2 || acronym.length > 8 || seen.has(acronym)) continue;
      if (WELL_KNOWN.has(acronym) || ROMAN.test(acronym)) continue;
      seen.add(acronym);
      const index = match.index ?? 0;
      const definedHere = block.text[index - 1] === "(" && block.text[index + match[0].length] === ")";
      if (!definedHere) found.push({ acronym, blockId: block.id });
    }
  }
  return found;
}
