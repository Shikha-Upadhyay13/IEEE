import type { ReferenceFields } from "./generateReferenceText";

/**
 * Parses a BibTeX string containing one or more entries into an array of ReferenceFields.
 * Supports standard entry types (@article, @inproceedings, @conference, @book, @techreport, etc.)
 */
export function parseBibtex(bibtex: string): ReferenceFields[] {
  const entries: ReferenceFields[] = [];
  let i = 0;

  while (i < bibtex.length) {
    const atPos = bibtex.indexOf("@", i);
    if (atPos === -1) break;

    const openBrace = bibtex.indexOf("{", atPos);
    if (openBrace === -1) break;

    const commaPos = bibtex.indexOf(",", openBrace);
    if (commaPos === -1) break;

    // Track matching closing brace for the entry
    let depth = 1;
    let curr = openBrace + 1;
    while (curr < bibtex.length && depth > 0) {
      if (bibtex[curr] === "{") depth++;
      else if (bibtex[curr] === "}") depth--;
      curr++;
    }

    const body = bibtex.slice(commaPos + 1, curr - 1);
    const fields = parseBibtexFields(body);

    const authors = formatAuthors(fields.author || fields.authors || "");
    const venue =
      fields.journal ||
      fields.booktitle ||
      fields.publisher ||
      fields.school ||
      fields.institution ||
      "";
    const pages = cleanBraces(fields.pages || "").replace(/--/g, "-");
    const title = cleanBraces(fields.title || "");

    if (title || authors || venue) {
      entries.push({
        authors,
        title,
        venue: cleanBraces(venue),
        year: cleanBraces(fields.year || ""),
        volume: cleanBraces(fields.volume || ""),
        pages,
      });
    }

    i = curr;
  }

  return entries;
}

function parseBibtexFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let idx = 0;

  while (idx < body.length) {
    // Find next '='
    const eqIdx = body.indexOf("=", idx);
    if (eqIdx === -1) break;

    // Extract key name before '='
    const beforeEq = body.slice(idx, eqIdx);
    const keyMatch = /[a-zA-Z0-9_-]+$/.exec(beforeEq.trim());
    if (!keyMatch) {
      idx = eqIdx + 1;
      continue;
    }
    const key = keyMatch[0].toLowerCase();

    // Skip whitespace after '='
    let valStart = eqIdx + 1;
    while (valStart < body.length && /\s/.test(body[valStart])) {
      valStart++;
    }

    if (valStart >= body.length) break;

    let value = "";
    let nextIdx = valStart;

    if (body[valStart] === "{") {
      // Braced value: { ... }
      let depth = 1;
      let p = valStart + 1;
      while (p < body.length && depth > 0) {
        if (body[p] === "{") depth++;
        else if (body[p] === "}") depth--;
        p++;
      }
      value = body.slice(valStart + 1, p - 1);
      nextIdx = p;
    } else if (body[valStart] === '"') {
      // Quoted value: " ... "
      let p = valStart + 1;
      while (p < body.length && body[p] !== '"') {
        if (body[p] === "\\") p++; // escape
        p++;
      }
      value = body.slice(valStart + 1, p);
      nextIdx = p + 1;
    } else {
      // Bare number or literal up to comma or closing brace
      const comma = body.indexOf(",", valStart);
      if (comma !== -1) {
        value = body.slice(valStart, comma).trim();
        nextIdx = comma + 1;
      } else {
        value = body.slice(valStart).trim();
        nextIdx = body.length;
      }
    }

    fields[key] = value.replace(/\s+/g, " ").trim();
    idx = nextIdx;
  }

  return fields;
}

function cleanBraces(str: string): string {
  return str.replace(/[{}]/g, "").trim();
}

function formatAuthors(raw: string): string {
  if (!raw) return "";
  const cleaned = cleanBraces(raw);
  const list = cleaned.split(/\s+and\s+/i).map((author) => {
    author = author.trim();
    if (author.includes(",")) {
      // Format: "Last, First Middle" -> "F. M. Last"
      const [last, first] = author.split(",").map((s) => s.trim());
      if (first && last) {
        const initials = first
          .split(/\s+/)
          .filter(Boolean)
          .map((n) => `${n[0]}.`)
          .join(" ");
        return `${initials} ${last}`.trim();
      }
      return author;
    } else {
      // Format: "First Middle Last" -> "F. M. Last"
      const parts = author.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        const last = parts[parts.length - 1];
        const initials = parts
          .slice(0, -1)
          .map((n) => `${n[0]}.`)
          .join(" ");
        return `${initials} ${last}`;
      }
      return author;
    }
  });

  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}
