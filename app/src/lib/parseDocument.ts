import { DocumentSchema, type Document } from "../types/document";

export type ParseDocumentResult =
  | { ok: true; document: Document; repaired: boolean }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Fills in top-level fields that older or hand-edited papers may be missing.
 * Only ever adds defaults — never drops or rewrites content the author wrote.
 */
function withDefaults(raw: Record<string, unknown>): Record<string, unknown> {
  const meta = isRecord(raw.meta) ? raw.meta : {};
  const titleBlock = isRecord(raw.titleBlock) ? raw.titleBlock : {};
  const abstract = isRecord(raw.abstract) ? raw.abstract : {};
  return {
    ...raw,
    schemaVersion: raw.schemaVersion ?? 1,
    meta: {
      ...meta,
      template: meta.template ?? "ieee-conference",
      paperSize: meta.paperSize ?? "letter",
      pageLimit: meta.pageLimit ?? null,
    },
    titleBlock: {
      ...titleBlock,
      title: titleBlock.title ?? [],
      authors: titleBlock.authors ?? [],
      affiliations: titleBlock.affiliations ?? [],
    },
    abstract: { ...abstract, text: abstract.text ?? "" },
    keywords: raw.keywords ?? [],
    body: raw.body ?? [],
    references: raw.references ?? [],
  };
}

/**
 * Validates a paper loaded from the database before it reaches the editor or
 * renderer, so a malformed row shows a clear error instead of crashing (or
 * being autosaved over).
 */
export function parseDocument(raw: unknown): ParseDocumentResult {
  if (!isRecord(raw)) return { ok: false, error: "The paper's content is empty or not an object." };
  const candidate = withDefaults(raw);
  const result = DocumentSchema.safeParse(candidate);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? issue.path.join(".") : "the paper";
    return { ok: false, error: `Invalid data at ${where}: ${issue?.message ?? "unknown problem"}` };
  }
  const repaired = JSON.stringify(candidate) !== JSON.stringify(raw);
  return { ok: true, document: result.data, repaired };
}
