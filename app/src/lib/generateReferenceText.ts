export type ReferenceFields = {
  authors: string;
  title: string;
  venue: string;
  year: string;
  volume: string;
  pages: string;
};

export const emptyReferenceFields: ReferenceFields = {
  authors: "",
  title: "",
  venue: "",
  year: "",
  volume: "",
  pages: "",
};

// Renders the common "periodical/conference paper" IEEE reference shape —
// e.g. J. F. Fuller, E. F. Fuchs, and K. J. Roesler, "Influence of harmonics
// on power distribution system protection," IEEE Trans. Power Delivery,
// vol. 3, pp. 549-557, Apr. 1988.
// This is deliberately the one common case covered for v1 (per PRD §7.2:
// "manual structured fields ... rendered into the one fixed IEEE style"),
// not every IEEE reference type — books, patents, standards, and theses each
// have their own distinct format per the official IEEE reference guide, and
// would need their own field sets/templates if added later.
export function generateReferenceText(fields: ReferenceFields): string {
  // Everything after the title, pre-joined — built first so the title's own
  // punctuation can be decided from whether anything actually follows it.
  const rest = [fields.venue, fields.volume && `vol. ${fields.volume}`, fields.pages && `pp. ${fields.pages}`, fields.year]
    .filter(Boolean)
    .join(", ");

  const authorPart = fields.authors ? `${fields.authors}, ` : "";
  // Comma inside the closing quote when something follows (IEEE style:
  // "...protection," IEEE Trans. ...) — using the outer ", " join here
  // instead would double up into "...protection,", IEEE ..." whenever venue
  // is blank but a later field (e.g. year) isn't, which is exactly the case
  // a reference missing its venue hits.
  const titlePart = fields.title ? (rest ? `"${fields.title}," ` : `"${fields.title}"`) : "";

  const text = `${authorPart}${titlePart}${rest}`.trim();
  if (!text) return "";
  return text.endsWith(".") ? text : `${text}.`;
}
