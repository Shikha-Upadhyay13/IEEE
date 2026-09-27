import type { Document, ResolvedBodyNode } from "../../types/document";
import { resolveNumbering } from "../numbering";

type LiveNumbers = {
  references: Map<string, number>;
  figures: Map<string, number>;
  tables: Map<string, string>;
};

// Every citation/cross-ref chip in the editor asks for its number on each
// store update; caching per document object means one resolve pass per edit
// is shared across all chips instead of one per chip.
const cache = new WeakMap<Document, LiveNumbers>();

function compute(doc: Document): LiveNumbers {
  const resolved = resolveNumbering(doc);
  const figures = new Map<string, number>();
  const tables = new Map<string, string>();
  (function walk(nodes: ResolvedBodyNode[]) {
    for (const node of nodes) {
      if (node.type === "figure") figures.set(node.id, node.resolvedNumber);
      else if (node.type === "table") tables.set(node.id, node.resolvedNumber);
      else if (node.type === "section") walk(node.children);
    }
  })(resolved.body);
  return {
    references: new Map(resolved.references.map((r) => [r.id, r.resolvedNumber])),
    figures,
    tables,
  };
}

function liveNumbers(doc: Document): LiveNumbers {
  let numbers = cache.get(doc);
  if (!numbers) {
    numbers = compute(doc);
    cache.set(doc, numbers);
  }
  return numbers;
}

export function citationNumberFor(doc: Document, refId: string): number | null {
  return liveNumbers(doc).references.get(refId) ?? null;
}

export function xrefLabelFor(doc: Document, targetType: "figure" | "table", targetId: string): string | null {
  const numbers = liveNumbers(doc);
  if (targetType === "figure") {
    const n = numbers.figures.get(targetId);
    return n === undefined ? null : `Fig. ${n}`;
  }
  const n = numbers.tables.get(targetId);
  return n === undefined ? null : `Table ${n}`;
}
