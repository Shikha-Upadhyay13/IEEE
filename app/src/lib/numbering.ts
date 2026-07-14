import type {
  Document,
  BodyNode,
  ResolvedBodyNode,
  InlineNode,
  ResolvedInlineNode,
  ResolvedDocument,
} from "../types/document";

// Simple int -> Roman numeral conversion (no library needed for paper-scale numbers).
function toRoman(num: number): string {
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let n = num;
  let result = "";
  for (const [value, symbol] of table) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
}

type Counters = {
  figure: number;
  table: number;
  equation: number;
};

// n=1 -> A, 26 -> Z, 27 -> AA (IEEE papers rarely nest deep enough to hit this).
function toLetters(num: number): string {
  let n = num;
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

// IEEE section numbering convention by nesting depth:
// depth 0 (top-level): Roman numerals — I, II, III
// depth 1 (subsection): capital letters — A, B, C
// depth 2: Arabic numerals — 1, 2, 3
// depth 3+: lowercase letters — a, b, c
function formatSectionNumber(siblingIndex: number, depth: number): string {
  if (depth === 0) return toRoman(siblingIndex);
  if (depth === 1) return toLetters(siblingIndex);
  if (depth === 2) return String(siblingIndex);
  return toLetters(siblingIndex).toLowerCase();
}

/**
 * Deterministic tree-walk: assigns figure/table/equation/section numbers and
 * builds the citation first-appearance order, all from current block order.
 * Never reads or writes stored numbers — this is the only place numbers exist.
 */
export function resolveNumbering(doc: Document): ResolvedDocument {
  const counters: Counters = { figure: 0, table: 0, equation: 0 };
  const citationOrder = new Map<string, number>();

  function citationNumber(refId: string): number {
    let n = citationOrder.get(refId);
    if (n === undefined) {
      n = citationOrder.size + 1;
      citationOrder.set(refId, n);
    }
    return n;
  }

  function resolveInline(nodes: InlineNode[]): ResolvedInlineNode[] {
    return nodes.map((node) => {
      if (node.type === "citeRef") {
        return { ...node, resolvedNumber: citationNumber(node.refId) };
      }
      if (node.type === "xref") {
        // xref numbers are resolved in a second pass (see below), since a figure/table
        // may be cited before it's walked. Placeholder here, patched after the main walk.
        return { ...node, resolvedNumber: -1 };
      }
      return node;
    });
  }

  function resolveBody(nodes: BodyNode[], depth: number): ResolvedBodyNode[] {
    // Scoped to this one call, i.e. to one set of siblings — this is what makes
    // subsection numbering reset within each parent instead of sharing a global count.
    let sectionSiblingIndex = 0;
    return nodes.map((node): ResolvedBodyNode => {
      switch (node.type) {
        case "section": {
          sectionSiblingIndex += 1;
          const number = formatSectionNumber(sectionSiblingIndex, depth);
          return {
            ...node,
            resolvedNumber: number,
            children: resolveBody(node.children, depth + 1),
          };
        }
        case "paragraph":
          return { ...node, content: resolveInline(node.content) };
        case "figure":
          counters.figure += 1;
          return {
            ...node,
            resolvedNumber: counters.figure,
            caption: resolveInline(node.caption),
          };
        case "table":
          counters.table += 1;
          return {
            ...node,
            spacing: node.spacing ?? "comfortable", // default for tables predating this field
            resolvedNumber: toRoman(counters.table),
            caption: resolveInline(node.caption),
          };
        case "equation":
          counters.equation += 1;
          return { ...node, resolvedNumber: counters.equation };
      }
    });
  }

  const resolvedBody = resolveBody(doc.body, 0);

  // Second pass: patch xref placeholders now that every figure/table has a number.
  const figureNumbers = new Map<string, number>();
  const tableNumbers = new Map<string, string>();
  (function collect(nodes: ResolvedBodyNode[]) {
    for (const node of nodes) {
      if (node.type === "figure") figureNumbers.set(node.id, node.resolvedNumber);
      if (node.type === "table") tableNumbers.set(node.id, node.resolvedNumber as unknown as string);
      if (node.type === "section") collect(node.children);
    }
  })(resolvedBody);

  (function patchXrefs(nodes: ResolvedBodyNode[]) {
    for (const node of nodes) {
      if (node.type === "paragraph") {
        node.content = node.content.map((inline) => {
          if (inline.type === "xref") {
            const num =
              inline.targetType === "figure"
                ? figureNumbers.get(inline.targetId)
                : tableNumbers.get(inline.targetId);
            return { ...inline, resolvedNumber: num ?? 0 };
          }
          return inline;
        });
      }
      if (node.type === "section") patchXrefs(node.children);
    }
  })(resolvedBody);

  // Cited references get their first-appearance number (1..N). Uncited ones
  // (a real, common case once references can be added via a form before —
  // or without ever — being cited in text) continue numbering from N+1 in
  // their existing list order, rather than sorting a placeholder number
  // like Number.MAX_SAFE_INTEGER, which would render as "[9007199254740991]".
  const cited = doc.references
    .filter((ref) => citationOrder.has(ref.id))
    .map((ref) => ({ ...ref, resolvedNumber: citationOrder.get(ref.id)! }))
    .sort((a, b) => a.resolvedNumber - b.resolvedNumber);
  const uncited = doc.references
    .filter((ref) => !citationOrder.has(ref.id))
    .map((ref, i) => ({ ...ref, resolvedNumber: cited.length + i + 1 }));
  const resolvedReferences = [...cited, ...uncited];

  return {
    ...doc,
    body: resolvedBody,
    references: resolvedReferences,
  };
}
